import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Address,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  hash,
  rpc,
} from "@stellar/stellar-sdk";

const rpcUrl = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const friendbot = process.env.STELLAR_FRIENDBOT ?? "https://friendbot.stellar.org";

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = resolve(
  here,
  "../../../contracts/escrow/target/wasm32v1-none/release/escrow.wasm",
);

async function submit(server, keypair, operation) {
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

async function main() {
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  const wasm = readFileSync(wasmPath);
  const wasmHash = hash(wasm);

  const deployer = Keypair.random();
  console.log(JSON.stringify({ msg: "deployer", publicKey: deployer.publicKey() }));

  const funding = await fetch(`${friendbot}?addr=${deployer.publicKey()}`);
  console.log(JSON.stringify({ msg: "friendbot", ok: funding.ok }));

  const upload = await submit(server, deployer, Operation.uploadContractWasm({ wasm }));
  console.log(JSON.stringify({ msg: "wasm-uploaded", hash: upload.hash, status: upload.result.status }));

  const create = await submit(
    server,
    deployer,
    Operation.createCustomContract({
      address: new Address(deployer.publicKey()),
      wasmHash,
    }),
  );
  console.log(JSON.stringify({ msg: "contract-created", hash: create.hash, status: create.result.status }));

  const returnValue = create.result.returnValue;
  if (returnValue) {
    const contractId = Address.fromScVal(returnValue).toString();
    console.log(
      JSON.stringify({
        msg: "deployed",
        contractId,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
      }),
    );
    console.log(`ESCROW_CONTRACT_ID=${contractId}`);
  } else {
    console.log(JSON.stringify({ msg: "no-return-value", result: create.result }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
