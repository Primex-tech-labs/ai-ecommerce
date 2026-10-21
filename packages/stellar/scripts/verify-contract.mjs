import { Networks, rpc, xdr } from "@stellar/stellar-sdk";

const contractId = process.env.ESCROW_CONTRACT_ID ?? process.argv[2];
if (!contractId) {
  console.error("usage: ESCROW_CONTRACT_ID=... node scripts/verify-contract.mjs");
  process.exit(1);
}

const rpcUrl = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });

try {
  // Read the contract instance entry. This fails when the contract does not
  // exist, unlike simulating a call where contract errors and missing
  // contracts can look similar.
  const entry = await server.getContractData(
    contractId,
    xdr.ScVal.scvLedgerKeyContractInstance(),
    rpc.Durability.Persistent,
  );
  const instance = await server.getContractInstance(contractId);
  const wasmHash = instance.executable.wasmHash?.toString("hex");
  const explorerBase = networkPassphrase === Networks.PUBLIC ? "public" : "testnet";
  console.log(
    JSON.stringify({
      msg: "contract-live",
      contractId,
      latestLedger: entry.latestLedger,
      lastModifiedLedger: entry.lastModifiedLedgerSeq,
      liveUntilLedger: entry.liveUntilLedgerSeq,
      wasmHash,
      explorer: `https://stellar.expert/explorer/${explorerBase}/contract/${contractId}`,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      msg: "contract-unavailable",
      contractId,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
}
