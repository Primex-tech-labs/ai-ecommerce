import {
  Account,
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  buildCreateEscrow,
  buildFundEscrow,
  buildReleaseEscrow,
  readEscrow,
  resolveConfig,
  submitSignedTransaction,
} from "@repo/stellar";
import { deployEscrow } from "./deploy-escrow.mjs";
import { verifyContract } from "./verify-contract.mjs";

const AMOUNT = 100_000_000n; // 10 units with 7 decimals
const ASSET_ISSUED = "1000";
const ASSET_CODE_RE = /^[A-Z0-9]{1,12}$/;

function log(value) {
  console.log(typeof value === "string" ? value : JSON.stringify(value));
}

function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fundViaFriendbot(friendbot, address) {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `${friendbot}?addr=${encodeURIComponent(address)}`,
        30_000,
      );
      if (response.ok) return;
      const body = await response.text();
      lastError = `HTTP ${response.status}: ${body.slice(0, 200)}`;
      if (response.status === 400) {
        throw new Error(`friendbot rejected ${address}: ${lastError}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError.startsWith("friendbot rejected")) throw error;
    }
    await sleep(1_000 * attempt);
  }
  throw new Error(`friendbot failed for ${address}: ${lastError}`);
}

async function submitOperation(server, signer, operations, networkPassphrase) {
  const account = await server.getAccount(signer.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  }).setTimeout(180);
  for (const operation of operations) builder.addOperation(operation);
  const prepared = await server.prepareTransaction(builder.build());
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`submit error: ${JSON.stringify(sent.errorResult)}`);
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (result.status !== "SUCCESS") {
    throw new Error(`transaction ${sent.hash} status ${result.status}`);
  }
  return { hash: sent.hash, status: result.status, ledger: result.ledger };
}

async function submitClassic(horizon, signer, operations, networkPassphrase) {
  const account = await horizon.loadAccount(signer.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  }).setTimeout(180);
  for (const operation of operations) builder.addOperation(operation);
  const transaction = builder.build();
  transaction.sign(signer);
  const result = await horizon.submitTransaction(transaction);
  return { hash: result.hash, status: "SUCCESS", ledger: result.ledger };
}

async function tokenBalance(
  server,
  tokenContractId,
  address,
  networkPassphrase,
) {
  const contract = new Contract(tokenContractId);
  const source = new Account(Keypair.random().publicKey(), "0");
  const transaction = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(contract.call("balance", new Address(address).toScVal()))
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`balance simulation failed: ${simulation.error}`);
  }
  if (!simulation.result) {
    throw new Error("balance simulation returned no value");
  }
  return BigInt(scValToNative(simulation.result.retval).toString());
}

function sign(transactionXdr, signer, networkPassphrase) {
  const transaction = TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase,
  );
  transaction.sign(signer);
  return transaction.toXDR();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function main() {
  if (!enabled(process.env.STELLAR_SMOKE_TEST)) {
    log({
      msg: "skipped",
      reason: "set STELLAR_SMOKE_TEST=1 to run the testnet smoke test",
    });
    return;
  }

  const config = resolveConfig(process.env);
  if (config.networkPassphrase !== Networks.TESTNET) {
    throw new Error("the smoke test only runs against Stellar testnet");
  }

  const assetCode = (
    process.env.STELLAR_SMOKE_ASSET_CODE ?? "SMOKE"
  ).toUpperCase();
  if (!ASSET_CODE_RE.test(assetCode)) {
    throw new Error("STELLAR_SMOKE_ASSET_CODE must be 1-12 letters or digits");
  }

  const friendbot =
    process.env.STELLAR_FRIENDBOT ?? "https://friendbot.stellar.org";
  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const horizon = new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  });

  let health;
  try {
    health = await withTimeout(
      server.getHealth(),
      15_000,
      "RPC health check timed out",
    );
  } catch (error) {
    log({
      msg: "skipped",
      reason: "network unreachable",
      rpcUrl: config.rpcUrl,
      detail: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  log({
    msg: "network",
    rpcUrl: config.rpcUrl,
    status: health.status,
    latestLedger: health.latestLedger,
  });
  if (health.status !== "healthy") {
    log({ msg: "skipped", reason: `RPC is ${health.status}` });
    return;
  }

  // 1. Fund fresh accounts.
  const issuer = Keypair.random();
  const buyer = Keypair.random();
  const seller = Keypair.random();
  log({
    msg: "accounts",
    issuer: issuer.publicKey(),
    buyer: buyer.publicKey(),
    seller: seller.publicKey(),
  });
  for (const account of [issuer, buyer, seller]) {
    await fundViaFriendbot(friendbot, account.publicKey());
  }

  // 2. Create a test asset and its Stellar Asset Contract.
  const asset = new Asset(assetCode, issuer.publicKey());
  const sacContractId = asset.contractId(config.networkPassphrase);
  const sacTransaction = await submitOperation(
    server,
    issuer,
    [Operation.createStellarAssetContract({ asset })],
    config.networkPassphrase,
  );
  log({ msg: "sac", contractId: sacContractId, hash: sacTransaction.hash });
  log({
    msg: "verify-sac",
    ...(await verifyContract(sacContractId, {
      server,
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.networkPassphrase,
    })),
  });

  // 3. Trust and fund the buyer with the test asset.
  await submitClassic(
    horizon,
    buyer,
    [Operation.changeTrust({ asset, limit: "1000000" })],
    config.networkPassphrase,
  );
  await submitClassic(
    horizon,
    seller,
    [Operation.changeTrust({ asset, limit: "1000000" })],
    config.networkPassphrase,
  );
  await submitClassic(
    horizon,
    issuer,
    [
      Operation.payment({
        destination: buyer.publicKey(),
        asset,
        amount: ASSET_ISSUED,
      }),
    ],
    config.networkPassphrase,
  );

  // 4. Deploy a fresh escrow contract with the deploy tooling.
  const deployment = await deployEscrow({
    server,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    friendbot,
    log,
  });
  const escrowConfig = {
    ...config,
    escrowContractId: deployment.contractId,
  };
  log({
    msg: "verify-escrow",
    ...(await verifyContract(deployment.contractId, {
      server,
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.networkPassphrase,
    })),
  });

  const buyerBefore = await tokenBalance(
    server,
    sacContractId,
    buyer.publicKey(),
    config.networkPassphrase,
  );
  const sellerBefore = await tokenBalance(
    server,
    sacContractId,
    seller.publicKey(),
    config.networkPassphrase,
  );
  const escrowBefore = await tokenBalance(
    server,
    sacContractId,
    deployment.contractId,
    config.networkPassphrase,
  );
  assertEqual(escrowBefore, 0n, "escrow balance before funding");
  if (buyerBefore < AMOUNT) {
    throw new Error(`buyer balance ${buyerBefore} is below ${AMOUNT}`);
  }

  // 5. create then fund through the @repo/stellar transaction builders.
  const orderId = `smoke${Date.now().toString(36)}`;
  const create = await buildCreateEscrow(escrowConfig, {
    orderId,
    buyer: buyer.publicKey(),
    seller: seller.publicKey(),
    token: sacContractId,
    amount: AMOUNT,
  });
  const createdTx = await submitSignedTransaction(
    escrowConfig,
    sign(create.xdr, buyer, config.networkPassphrase),
  );
  log({ msg: "create", orderId, ...createdTx });

  const fund = await buildFundEscrow(escrowConfig, orderId, buyer.publicKey());
  const fundedTx = await submitSignedTransaction(
    escrowConfig,
    sign(fund.xdr, buyer, config.networkPassphrase),
  );
  log({ msg: "fund", orderId, ...fundedTx });

  const fundedEscrow = await readEscrow(escrowConfig, orderId);
  if (fundedEscrow?.status !== "Funded") {
    throw new Error(`expected Funded escrow, got ${fundedEscrow?.status}`);
  }

  const buyerAfterFund = await tokenBalance(
    server,
    sacContractId,
    buyer.publicKey(),
    config.networkPassphrase,
  );
  const sellerAfterFund = await tokenBalance(
    server,
    sacContractId,
    seller.publicKey(),
    config.networkPassphrase,
  );
  const escrowAfterFund = await tokenBalance(
    server,
    sacContractId,
    deployment.contractId,
    config.networkPassphrase,
  );
  assertEqual(buyerAfterFund, buyerBefore - AMOUNT, "buyer balance after fund");
  assertEqual(sellerAfterFund, sellerBefore, "seller balance after fund");
  assertEqual(escrowAfterFund, AMOUNT, "escrow balance after fund");

  // 6. Release through the @repo/stellar transaction builder.
  const release = await buildReleaseEscrow(
    escrowConfig,
    orderId,
    buyer.publicKey(),
  );
  const releasedTx = await submitSignedTransaction(
    escrowConfig,
    sign(release.xdr, buyer, config.networkPassphrase),
  );
  log({ msg: "release", orderId, ...releasedTx });

  const releasedEscrow = await readEscrow(escrowConfig, orderId);
  if (releasedEscrow?.status !== "Released") {
    throw new Error(`expected Released escrow, got ${releasedEscrow?.status}`);
  }

  const buyerAfterRelease = await tokenBalance(
    server,
    sacContractId,
    buyer.publicKey(),
    config.networkPassphrase,
  );
  const sellerAfterRelease = await tokenBalance(
    server,
    sacContractId,
    seller.publicKey(),
    config.networkPassphrase,
  );
  const escrowAfterRelease = await tokenBalance(
    server,
    sacContractId,
    deployment.contractId,
    config.networkPassphrase,
  );
  assertEqual(buyerAfterRelease, buyerAfterFund, "buyer balance after release");
  assertEqual(
    sellerAfterRelease,
    sellerBefore + AMOUNT,
    "seller balance after release",
  );
  assertEqual(escrowAfterRelease, 0n, "escrow balance after release");

  log({
    msg: "balances",
    asset: `${assetCode}:${issuer.publicKey()}`,
    amount: AMOUNT.toString(),
    buyer: {
      before: buyerBefore.toString(),
      after: buyerAfterRelease.toString(),
    },
    seller: {
      before: sellerBefore.toString(),
      after: sellerAfterRelease.toString(),
    },
    escrow: {
      before: escrowBefore.toString(),
      after: escrowAfterRelease.toString(),
    },
  });
  log({
    msg: "done",
    escrowContractId: deployment.contractId,
    sacContractId,
    orderId,
    wasmHash: toHex(deployment.wasmHash),
    hashes: {
      sac: sacTransaction.hash,
      create: createdTx.hash,
      fund: fundedTx.hash,
      release: releasedTx.hash,
      wasmUpload: deployment.uploadHash,
      contractCreate: deployment.createHash,
    },
  });
}

main().catch((error) => {
  log({
    msg: "failed",
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
