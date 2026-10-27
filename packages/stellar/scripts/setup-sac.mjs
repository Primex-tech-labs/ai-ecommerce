import {
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASES = {
  local: "Standalone Network ; February 2017",
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  mainnet: Networks.PUBLIC,
};

const NETWORK_RPC_URLS = {
  local: "http://localhost:8001/soroban/rpc",
  testnet: "https://soroban-testnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

const NETWORK_EXPLORERS = {
  local: "http://localhost:8001",
  testnet: "https://stellar.expert/explorer/testnet",
  futurenet: "https://stellar.expert/explorer/futurenet",
  mainnet: "https://stellar.expert/explorer/public",
};

const ASSET_CODE_PATTERN = /^[A-Za-z0-9]{1,12}$/;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function requiredEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    fail(
      `missing ${name}. Set STELLAR_ASSET_CODE, STELLAR_ASSET_ISSUER and ` +
        "STELLAR_ASSET_ISSUER_SECRET before running setup:sac",
    );
  }
  return value;
}

const network = (process.env.STELLAR_NETWORK ?? "testnet").trim().toLowerCase();
const networkPassphrase =
  process.env.STELLAR_NETWORK_PASSPHRASE ?? NETWORK_PASSPHRASES[network];
const rpcUrl = process.env.STELLAR_RPC_URL ?? NETWORK_RPC_URLS[network];
const friendbot = process.env.STELLAR_FRIENDBOT ?? "https://friendbot.stellar.org/";
const explorer = process.env.STELLAR_EXPLORER ?? NETWORK_EXPLORERS[network];

if (!networkPassphrase || !rpcUrl) {
  fail(
    `unsupported STELLAR_NETWORK ${JSON.stringify(network)}; ` +
      "set STELLAR_NETWORK_PASSPHRASE and STELLAR_RPC_URL instead",
  );
}

const code = requiredEnv("STELLAR_ASSET_CODE");
const issuer = requiredEnv("STELLAR_ASSET_ISSUER");
const issuerSecret = requiredEnv("STELLAR_ASSET_ISSUER_SECRET");

if (!ASSET_CODE_PATTERN.test(code)) {
  fail(`STELLAR_ASSET_CODE must be 1-12 alphanumeric characters, got ${JSON.stringify(code)}`);
}
if (!StrKey.isValidEd25519PublicKey(issuer)) {
  fail(`STELLAR_ASSET_ISSUER must be a Stellar account (G...), got ${JSON.stringify(issuer)}`);
}
if (!StrKey.isValidEd25519SecretSeed(issuerSecret)) {
  fail("STELLAR_ASSET_ISSUER_SECRET must be a Stellar secret seed (S...)");
}

const issuerKeypair = Keypair.fromSecret(issuerSecret);
if (issuerKeypair.publicKey() !== issuer) {
  fail("STELLAR_ASSET_ISSUER_SECRET does not match STELLAR_ASSET_ISSUER");
}

const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
const asset = new Asset(code, issuer);
// Mirrors deriveSacContractId in src/sac.ts; scripts run under plain Node.
const contractId = asset.contractId(networkPassphrase);

console.log(
  JSON.stringify({ msg: "issuer", publicKey: issuer, network, rpcUrl }),
);
console.log(JSON.stringify({ msg: "asset", code, issuer, contractId }));

let account;
try {
  account = await server.getAccount(issuer);
} catch (error) {
  const message = String(error?.message ?? error);
  if (/not.?found|does not exist|404/i.test(message)) {
    fail(
      `asset issuer ${issuer} is not funded on ${network}. ` +
        `Fund it first: ${friendbot}?addr=${issuer}`,
    );
  }
  fail(`could not load asset issuer ${issuer} from ${rpcUrl}: ${message}`);
}

const transaction = new TransactionBuilder(account, {
  fee: "2000000",
  networkPassphrase,
})
  .addOperation(Operation.createStellarAssetContract({ asset }))
  .setTimeout(180)
  .build();

function reportExisting() {
  console.log(JSON.stringify({ msg: "sac-exists", contractId }));
  console.log(`STELLAR_TOKEN_CONTRACT_ID=${contractId}`);
  process.exit(0);
}

let prepared;
try {
  prepared = await server.prepareTransaction(transaction);
} catch (error) {
  const message = String(error?.message ?? error);
  if (/ExistingValue|already exists/i.test(message)) {
    reportExisting();
  }
  fail(`could not prepare the SAC creation transaction: ${message}`);
}

prepared.sign(issuerKeypair);

const sent = await server.sendTransaction(prepared);
if (sent.status === "ERROR") {
  const details = JSON.stringify(sent.errorResult);
  if (/ExistingValue|already exists/i.test(details)) {
    reportExisting();
  }
  fail(`SAC creation was rejected: ${details}`);
}

const result = await server.pollTransaction(sent.hash, { attempts: 30 });
if (result.status !== "SUCCESS") {
  fail(`SAC creation ${sent.hash} finished with status ${result.status}`);
}

let onChainId;
if (result.returnValue) {
  try {
    onChainId = Address.fromScVal(result.returnValue).toString();
  } catch {
    onChainId = undefined;
  }
}
if (onChainId !== undefined && onChainId !== contractId) {
  fail(
    `the network returned SAC ${onChainId}, but the asset derives to ${contractId}. ` +
      "Refusing to print a mismatched id.",
  );
}

console.log(
  JSON.stringify({
    msg: "created",
    hash: sent.hash,
    status: result.status,
    explorer: `${explorer}/tx/${sent.hash}`,
  }),
);
console.log(
  JSON.stringify({
    msg: "sac",
    contractId,
    explorer: `${explorer}/contract/${contractId}`,
  }),
);
console.log(`STELLAR_TOKEN_CONTRACT_ID=${contractId}`);
