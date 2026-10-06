import {
  Account,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

const contractId = process.env.ESCROW_CONTRACT_ID ?? process.argv[2];
if (!contractId) {
  console.error("usage: ESCROW_CONTRACT_ID=... node scripts/verify-contract.mjs");
  process.exit(1);
}

const rpcUrl = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
const source = new Account(Keypair.random().publicKey(), "0");

const transaction = new TransactionBuilder(source, {
  fee: "100000",
  networkPassphrase,
})
  .addOperation(new Contract(contractId).call("get", nativeToScVal("missing", { type: "symbol" })))
  .setTimeout(30)
  .build();

const simulation = await server.simulateTransaction(transaction);
if (rpc.Api.isSimulationError(simulation)) {
  console.log(JSON.stringify({ msg: "contract-executed", contractId, error: simulation.error }));
} else if (rpc.Api.isSimulationSuccess(simulation)) {
  console.log(
    JSON.stringify({
      msg: "contract-executed",
      contractId,
      result: scValToNative(simulation.result.retval),
    }),
  );
} else {
  console.log(JSON.stringify({ msg: "unexpected", contractId, simulation }));
}
