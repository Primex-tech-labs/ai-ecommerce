import {
  Account,
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { StellarConfig } from "./config";
import { EscrowStatus, type EscrowRecord, type CreateEscrowParams, type UnsignedTransaction } from "./types";

const BASE_FEE = "1000000";
const TIMEOUT_SECONDS = 180;

export function toContractSymbol(orderId: string): string {
  const cleaned = orderId.replace(/[^a-zA-Z0-9_]/g, "_");
  return (cleaned || "order").slice(0, 32);
}

function createServer(config: StellarConfig): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
}

function assertContract(config: StellarConfig): void {
  if (!config.escrowContractId) {
    throw new Error("ESCROW_CONTRACT_ID is not configured");
  }
}

function assumeSimulationOk(
  simulation: rpc.Api.SimulateTransactionResponse,
): asserts simulation is rpc.Api.SimulateTransactionSuccessResponse {
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`escrow simulation failed: ${simulation.error}`);
  }
}

function assemble(
  transaction: ReturnType<TransactionBuilder["build"]>,
  simulation: rpc.Api.SimulateTransactionSuccessResponse,
): string {
  const assembled = rpc.assembleTransaction(transaction, simulation);
  const built =
    typeof (assembled as { build?: () => { toXDR: () => string } }).build === "function"
      ? (assembled as { build: () => { toXDR: () => string } }).build()
      : (assembled as unknown as { toXDR: () => string });
  return built.toXDR();
}

export async function buildCreateAndFundEscrow(
  config: StellarConfig,
  params: CreateEscrowParams,
): Promise<UnsignedTransaction> {
  assertContract(config);
  const server = createServer(config);
  const account = await server.getAccount(params.buyer);
  const contract = new Contract(config.escrowContractId);
  const orderId = nativeToScVal(toContractSymbol(params.orderId), { type: "symbol" });

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "create",
        orderId,
        new Address(params.buyer).toScVal(),
        new Address(params.seller).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.amount, { type: "i128" }),
      ),
    )
    .addOperation(contract.call("fund", orderId))
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  assumeSimulationOk(simulation);
  return {
    xdr: assemble(transaction, simulation),
    networkPassphrase: config.networkPassphrase,
  };
}

export async function buildReleaseEscrow(
  config: StellarConfig,
  orderId: string,
  source: string,
): Promise<UnsignedTransaction> {
  return buildSingleCall(config, source, "release", orderId);
}

export async function buildRefundEscrow(
  config: StellarConfig,
  orderId: string,
  source: string,
): Promise<UnsignedTransaction> {
  return buildSingleCall(config, source, "refund", orderId);
}

async function buildSingleCall(
  config: StellarConfig,
  source: string,
  method: "release" | "refund",
  orderId: string,
): Promise<UnsignedTransaction> {
  assertContract(config);
  const server = createServer(config);
  const account = await server.getAccount(source);
  const contract = new Contract(config.escrowContractId);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(method, nativeToScVal(toContractSymbol(orderId), { type: "symbol" })),
    )
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  assumeSimulationOk(simulation);
  return {
    xdr: assemble(transaction, simulation),
    networkPassphrase: config.networkPassphrase,
  };
}

export async function submitSignedTransaction(
  config: StellarConfig,
  signedXdr: string,
): Promise<{ hash: string; status: string; ledger?: number }> {
  const server = createServer(config);
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase,
  ) as Parameters<rpc.Server["sendTransaction"]>[0];
  const sent = await server.sendTransaction(transaction);
  if (sent.status === "ERROR") {
    throw new Error(`transaction submission failed: ${JSON.stringify(sent.errorResult)}`);
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 20 });
  const ledger = "ledger" in result ? result.ledger : undefined;
  return { hash: sent.hash, status: result.status, ledger };
}

export async function readEscrow(
  config: StellarConfig,
  orderId: string,
): Promise<EscrowRecord | null> {
  assertContract(config);
  const server = createServer(config);
  const contract = new Contract(config.escrowContractId);
  const source = new Account(Keypair.random().publicKey(), "0");
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call("get", nativeToScVal(toContractSymbol(orderId), { type: "symbol" })),
    )
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) return null;
  const success = simulation as rpc.Api.SimulateTransactionSuccessResponse;
  if (!success.result) return null;
  const native = scValToNative(success.result.retval) as Record<string, unknown>;
  return {
    buyer: String(native.buyer),
    seller: String(native.seller),
    token: String(native.token),
    amount: BigInt(String(native.amount)),
    status: normalizeStatus(native.status),
  };
}

function normalizeStatus(value: unknown): EscrowStatus {
  if (value && typeof value === "object" && "tag" in value) {
    return String((value as { tag: unknown }).tag) as EscrowStatus;
  }
  return String(value) as EscrowStatus;
}
