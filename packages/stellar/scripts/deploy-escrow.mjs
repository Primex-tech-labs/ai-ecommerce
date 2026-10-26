import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Address,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  hash,
  rpc,
} from "@stellar/stellar-sdk";

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_WASM_PATH = resolve(
  here,
  "../../../contracts/escrow/target/wasm32v1-none/release/escrow.wasm",
);

export function resolveDeployOptions(options = {}) {
  const rpcUrl =
    options.rpcUrl ??
    process.env.STELLAR_RPC_URL ??
    "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    options.networkPassphrase ??
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    Networks.TESTNET;
  const friendbot =
    options.friendbot ??
    process.env.STELLAR_FRIENDBOT ??
    "https://friendbot.stellar.org";
  return {
    rpcUrl,
    networkPassphrase,
    friendbot,
    wasmPath: options.wasmPath ?? DEFAULT_WASM_PATH,
  };
}

export async function submit(server, keypair, operation, networkPassphrase) {
  const account = await server.getAccount(keypair.publicKey());
  const built = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build();
  const prepared = await server.prepareTransaction(built);
  prepared.sign(keypair);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`submit error: ${JSON.stringify(sent.errorResult)}`);
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  return { hash: sent.hash, result };
}

/**
 * Upload the escrow wasm and deploy a fresh contract instance.
 *
 * Returns the contract id and the transaction hashes so callers (including the
 * smoke test) can record a verifiable transcript. The deployer is funded via
 * Friendbot by default; pass `fund: false` when it already exists.
 */
export async function deployEscrow(options = {}) {
  const config = resolveDeployOptions(options);
  const log = options.log ?? ((value) => console.log(value));
  const server =
    options.server ??
    new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
  const deployer = options.deployer ?? Keypair.random();
  if (!existsSync(config.wasmPath)) {
    throw new Error(
      `escrow wasm not found at ${config.wasmPath}; build it first with ` +
        '"stellar contract build" (see docs/stellar.md)',
    );
  }
  const wasm = readFileSync(config.wasmPath);
  const wasmHash = hash(wasm);

  log(JSON.stringify({ msg: "deployer", publicKey: deployer.publicKey() }));

  if (options.fund !== false) {
    const funding = await fetch(
      `${config.friendbot}?addr=${deployer.publicKey()}`,
    );
    log(JSON.stringify({ msg: "friendbot", ok: funding.ok }));
    if (!funding.ok) {
      throw new Error(`friendbot failed for ${deployer.publicKey()}`);
    }
  }

  const upload = await submit(
    server,
    deployer,
    Operation.uploadContractWasm({ wasm }),
    config.networkPassphrase,
  );
  log(
    JSON.stringify({
      msg: "wasm-uploaded",
      hash: upload.hash,
      status: upload.result.status,
    }),
  );

  const create = await submit(
    server,
    deployer,
    Operation.createCustomContract({
      address: new Address(deployer.publicKey()),
      wasmHash,
    }),
    config.networkPassphrase,
  );
  log(
    JSON.stringify({
      msg: "contract-created",
      hash: create.hash,
      status: create.result.status,
    }),
  );

  const returnValue = create.result.returnValue;
  if (!returnValue) {
    throw new Error("contract creation returned no contract id");
  }
  const contractId = Address.fromScVal(returnValue).toString();
  log(
    JSON.stringify({
      msg: "deployed",
      contractId,
      explorer: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
    }),
  );
  log(`ESCROW_CONTRACT_ID=${contractId}`);

  return {
    contractId,
    deployer,
    wasmHash,
    wasmPath: config.wasmPath,
    uploadHash: upload.hash,
    createHash: create.hash,
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  deployEscrow().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
