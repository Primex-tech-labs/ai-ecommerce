import type { Order } from "./orders";

export type OrderAction = "release" | "refund";

export type SourceCheck =
  | { ok: true; source: string }
  | { ok: false; error: string };

export function expectedSourceForAction(order: Order, action: OrderAction): string {
  return action === "release" ? order.buyer : order.seller;
}

export function resolveOrderActionSource(
  order: Order,
  source: unknown,
  action: OrderAction,
): SourceCheck {
  if (typeof source !== "string" || source.trim() === "") {
    return { ok: false, error: "source is required" };
  }
  if (source !== expectedSourceForAction(order, action)) {
    return {
      ok: false,
      error:
        action === "release"
          ? "source must match the order buyer"
          : "source must match the order seller",
    };
  }
  return { ok: true, source };
}
