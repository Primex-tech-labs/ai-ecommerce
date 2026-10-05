import type { Money } from "@repo/commerce-core";

export function Price({ value }: { value: Money }) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value.currency,
  }).format(value.amount);
  return <span className="font-semibold text-slate-900">{formatted}</span>;
}
