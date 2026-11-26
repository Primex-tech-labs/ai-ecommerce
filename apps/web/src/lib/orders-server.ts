import * as jsonStore from "./orders";
import * as pgStore from "./orders-pg";

export type { Order, OrderEvent, OrderStatus } from "./orders";

/**
 * Selects the persistence backend at request time:
 * - PostgreSQL when DATABASE_URL is configured (production / DB-backed envs),
 * - the legacy JSON store otherwise (local development and e2e without a DB).
 */
function usePostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getOrder(orderId: string) {
  return usePostgres() ? pgStore.getOrder(orderId) : jsonStore.getOrder(orderId);
}

export function listOrders() {
  return usePostgres() ? pgStore.listOrders() : jsonStore.listOrders();
}

export function listOrdersByOwner(
  ownerId: string,
  options?: { limit?: number; offset?: number },
) {
  return usePostgres()
    ? pgStore.listOrdersByOwner(ownerId, options)
    : jsonStore.listOrders();
}

export function updateOrder(
  orderId: string,
  update: Parameters<typeof jsonStore.updateOrder>[1],
) {
  return usePostgres()
    ? pgStore.updateOrder(orderId, update)
    : jsonStore.updateOrder(orderId, update);
}

export function upsertFromEvent(event: Parameters<typeof jsonStore.upsertFromEvent>[0]) {
  return usePostgres()
    ? pgStore.upsertFromEvent(event)
    : jsonStore.upsertFromEvent(event);
}

export async function claimOrderOwner(
  orderId: string,
  ownerId: string,
  input: Parameters<typeof pgStore.claimOrderOwner>[2],
): Promise<void> {
  if (!usePostgres()) return;
  await pgStore.claimOrderOwner(orderId, ownerId, input);
}
