import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Networks, rpc, xdr } from "@stellar/stellar-sdk";

export function resolveVerifyOptions(options = {}) {
  const rpcUrl =
    options.rpcUrl ??
    process.env.STELLAR_RPC_URL ??
    "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    options.networkPassphrase ??
    process.env.STELLAR_NETWORK_PASSPHRASE ??
    Networks.TESTNET;
  return { rpcUrl, networkPassphrase };
}

/**
 * Read a contract's instance entry (fails for a missing contract) and return
 * the verifiable summary used by the CLI and the smoke test.
 */
export async function verifyContract(contractId, options = {}) {
  if (!contractId) {
    throw new Error("contract id is required");
  }
  const config = resolveVerifyOptions(options);
  const server =
    options.server ??
    new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });

  const entry = await server.getContractData(
    contractId,
    xdr.ScVal.scvLedgerKeyContractInstance(),
    rpc.Durability.Persistent,
  );
  const instance = await server.getContractInstance(contractId);
  const wasmHash = instance.executable.wasmHash?.toString("hex");
  const explorerBase =
    config.networkPassphrase === Networks.PUBLIC ? "public" : "testnet";
  return {
    msg: "contract-live",
    contractId,
    latestLedger: entry.latestLedger,
    lastModifiedLedger: entry.lastModifiedLedgerSeq,
    liveUntilLedger: entry.liveUntilLedgerSeq,
    wasmHash,
    explorer: `https://stellar.expert/explorer/${explorerBase}/contract/${contractId}`,
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const contractId = process.env.ESCROW_CONTRACT_ID ?? process.argv[2];
  if (!contractId) {
    console.error(
      "usage: ESCROW_CONTRACT_ID=... node scripts/verify-contract.mjs",
    );
    process.exit(1);
  }
  verifyContract(contractId)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(
        JSON.stringify({
          msg: "contract-unavailable",
          contractId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exit(1);
    });
}
