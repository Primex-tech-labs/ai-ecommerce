import { rpc, scValToNative } from "@stellar/stellar-sdk";
import type { StellarConfig } from "./config";
import type { ContractEventSummary } from "./types";

export interface FetchEventsOptions {
  startLedger: number;
  limit?: number;
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  return undefined;
}

function decodeTopic(topic: unknown): string | undefined {
  if (topic === null || topic === undefined) return undefined;
  try {
    return asString(scValToNative(topic as Parameters<typeof scValToNative>[0]));
  } catch {
    return undefined;
  }
}

/**
 * Decode a Soroban contract event emitted by the escrow contract.
 *
 * `#[contractevent]` structs encode the event name as the first topic and every
 * `#[topic]` field next. Here the shape is `["created", orderId]` (or `funded`,
 * `released`, `refunded`); the remaining fields (`buyer`, `seller`, `token`,
 * `amount`) live in the event body.
 */
export function decodeEscrowEvent(event: rpc.Api.EventResponse): ContractEventSummary {
  const topics = event.topic ?? [];
  const name = decodeTopic(topics[0]);
  const orderId = decodeTopic(topics[1]);

  let body: Record<string, unknown> = {};
  try {
    const native = scValToNative(event.value);
    if (native !== null && typeof native === "object" && !Array.isArray(native)) {
      body = native as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  return {
    id: event.id,
    ledger: event.ledger,
    type: name ?? "unknown",
    orderId,
    buyer: asString(body.buyer),
    seller: asString(body.seller),
    token: asString(body.token),
    amount: asString(body.amount),
  };
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

  return response.events.map(decodeEscrowEvent);
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
