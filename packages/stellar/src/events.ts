import { rpc, scValToNative } from "@stellar/stellar-sdk";
import type { StellarConfig } from "./config";
import type { ContractEventSummary } from "./types";

export interface FetchEventsOptions {
  startLedger: number;
  limit?: number;
}

export async function fetchEscrowEvents(
  config: StellarConfig,
  options: FetchEventsOptions,
): Promise<ContractEventSummary[]> {
  if (!config.escrowContractId) {
    throw new Error("ESCROW_CONTRACT_ID is not configured");
  }
  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const response = await server.getEvents({
    startLedger: options.startLedger,
    filters: [{ type: "contract", contractIds: [config.escrowContractId] }],
    limit: options.limit ?? 100,
  });

  return response.events.map((event) => {
    const topic = event.topic?.[0];
    let orderId: string | undefined;
    if (topic) {
      const native = scValToNative(topic) as unknown;
      if (native !== null && native !== undefined) orderId = String(native);
    }
    return {
      id: event.id,
      ledger: event.ledger,
      type: String(event.type),
      orderId,
    };
  });
}

export function latestLedgerOf(events: ContractEventSummary[]): number | undefined {
  if (events.length === 0) return undefined;
  return events.reduce((max, event) => Math.max(max, event.ledger), 0);
}

export async function getLatestLedger(config: StellarConfig): Promise<number> {
  const server = new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
  const response = await server.getLatestLedger();
  return response.sequence;
}
