// Server-side helpers shared by the targets list and the place page.

import { STORE_TIME_ZONE } from "@/lib/orderActions";
import { TARGET_STATUS_COLORS, TargetStatus } from "@/lib/targets";

export interface LinkedOrder {
  id: string;
  target_id: string;
  customer_name: string;
  pickup_date: string;
  subtotal: number;
  discount?: number | null;
  status: string;
}

export const orderTotal = (o: LinkedOrder) => Number(o.subtotal) - Number(o.discount ?? 0);

// Cancelled orders don't count toward sales.
export const salesOf = (list: LinkedOrder[] = []) =>
  list.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + orderTotal(o), 0);

// Day difference between two YYYY-MM-DD dates (b - a).
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function storeDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(new Date(iso));
}

export function relativeDay(date: string, today: string): string {
  const d = daysBetween(date, today);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  return d > 0 ? `${d} days ago` : `in ${-d} days`;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
}

export function StatusPill({ status }: { status: TargetStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${TARGET_STATUS_COLORS[status].badge}`}>
      {status}
    </span>
  );
}

export function Flash({ saved, error }: { saved?: string | null; error?: string | null }) {
  return (
    <>
      {saved && (
        <p className="mb-4 rounded-xl border-2 border-black bg-green-100 px-4 py-3 text-sm font-bold text-green-900">{saved}</p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{error}</p>
      )}
    </>
  );
}
