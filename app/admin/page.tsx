import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/adminAuth";
import { ORDER_STATUSES, OrderStatus, STORE_TIME_ZONE, storeToday } from "@/lib/orderActions";
import { LineKind, itemDisplayName } from "@/lib/menu";
import { logout, setOrderStatus, setOrderTarget } from "./actions";

export const metadata: Metadata = {
  title: "Orders — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

type View = "upcoming" | "past" | "all";

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: "Pickup" | "Catering";
  pickup_date: string;
  pickup_time: string;
  delivery_address: string | null;
  payment_method: string;
  special_instructions: string | null;
  status: OrderStatus;
  subtotal: number;
  items: { kind?: LineKind; qty: number; name?: string; proteinName?: string; spicyLevel?: string; mods?: string[]; lineTotal: number }[];
  created_at: string;
  reminder_count: number;
  target_id?: string | null;
}

type TargetOption = { id: string; name: string };

const STATUS_STYLES: Record<OrderStatus, string> = {
  New: "bg-red-600 text-white",
  Confirmed: "bg-blue-600 text-white",
  Ready: "bg-green-600 text-white",
  Completed: "bg-gray-300 text-gray-800",
  Cancelled: "bg-gray-200 text-gray-500 line-through",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const adminEmail = await requireAdmin();
  const params = await searchParams;
  const view: View = params.view === "past" || params.view === "all" ? params.view : "upcoming";
  const statusFilter = ORDER_STATUSES.find((s) => s === params.status);
  const today = storeToday();

  const supabase = getSupabaseServerClient();
  let query = supabase.from("orders").select("*");
  if (view === "upcoming") {
    query = query.gte("pickup_date", today).order("pickup_date").order("pickup_time").limit(200);
  } else if (view === "past") {
    query = query.lt("pickup_date", today).order("pickup_date", { ascending: false }).order("pickup_time", { ascending: false }).limit(100);
  } else {
    query = query.order("created_at", { ascending: false }).limit(200);
  }
  if (statusFilter) query = query.eq("status", statusFilter);

  const [{ data, error }, { count: needsConfirm }, { data: targetRows }] = await Promise.all([
    query,
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "New")
      .gte("pickup_date", today),
    // For the "Sales target" picker; empty if the targets table doesn't exist yet.
    supabase.from("catering_targets").select("id, name").order("name").limit(500),
  ]);
  const orders = (data ?? []) as OrderRow[];
  const targetOptions = (targetRows ?? []) as TargetOption[];

  const href = (next: { view?: View; status?: string }) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    const s = "status" in next ? next.status : statusFilter;
    if (v !== "upcoming") p.set("view", v);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#FFD200] px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Cupbop Park City</p>
          <h1 className="text-xl font-extrabold">Orders</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <Link href="/" className="text-sm font-bold underline">
            Home
          </Link>
          <Link href="/admin/targets" className="text-sm font-bold underline">
            Targets
          </Link>
          <Link href="/admin/settings" className="text-sm font-bold underline">
            Availability
          </Link>
          <form action={logout} className="text-right">
            <p className="hidden text-xs font-semibold sm:block">{adminEmail}</p>
            <button className="text-sm font-bold underline">Sign out</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        {(needsConfirm ?? 0) > 0 && (
          <Link
            href={href({ view: "upcoming", status: "New" })}
            className="mb-4 block rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-bold text-red-900"
          >
            {needsConfirm} upcoming order{needsConfirm === 1 ? "" : "s"} waiting for confirmation →
          </Link>
        )}

        <nav className="mb-3 flex gap-2">
          {(["upcoming", "past", "all"] as View[]).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              className={`rounded-full border-2 border-black px-4 py-1.5 text-sm font-bold capitalize ${v === view ? "bg-black text-[#FFD200]" : "bg-white"}`}
            >
              {v}
            </Link>
          ))}
        </nav>
        <nav className="mb-5 flex flex-wrap gap-1.5">
          <Link
            href={href({ status: undefined })}
            className={`rounded-full border border-black px-3 py-1 text-xs font-bold ${!statusFilter ? "bg-black text-white" : "bg-white"}`}
          >
            Any status
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link
              key={s}
              href={href({ status: s })}
              className={`rounded-full border border-black px-3 py-1 text-xs font-bold ${statusFilter === s ? "bg-black text-white" : "bg-white"}`}
            >
              {s}
            </Link>
          ))}
        </nav>

        {error && (
          <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
            Could not load orders. Refresh to try again.
          </p>
        )}
        {!error && orders.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-600">No orders here.</p>
        )}

        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} targets={targetOptions} />
          ))}
        </ul>
      </main>
    </div>
  );
}

function OrderCard({ order: o, targets }: { order: OrderRow; targets: TargetOption[] }) {
  const target = o.target_id ? targets.find((t) => t.id === o.target_id) : undefined;
  // Bowls + buffet servings (old orders have no `kind`; they were all bowls).
  const bowls = o.items.reduce((sum, it) => sum + (it.kind === "extra" ? 0 : it.qty || 0), 0);

  return (
    <li id={`order-${o.id}`} className="scroll-mt-20 rounded-2xl border-2 border-black bg-white shadow-[0_3px_0_#000]">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div>
          <p className="text-base font-extrabold">
            {formatDate(o.pickup_date)} · {formatTime(o.pickup_time)}
          </p>
          <p className="text-sm">
            <span className="font-bold">{o.customer_name}</span>
            <span className="text-gray-600"> · {o.order_type} · {bowls} serving{bowls === 1 ? "" : "s"} · ${Number(o.subtotal).toFixed(2)}</span>
          </p>
          {target && (
            <Link href={`/admin/targets#target-${target.id}`} className="mt-0.5 inline-block text-xs font-bold text-green-800 underline">
              🎯 {target.name}
            </Link>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS_STYLES[o.status]}`}>
          {o.status}
        </span>
      </div>

      <details className="group px-4 pt-2">
        <summary className="cursor-pointer select-none text-xs font-bold text-gray-600 underline">Details</summary>
        <dl className="mt-2 space-y-1 text-sm">
          <Detail label="Phone"><a className="underline" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></Detail>
          <Detail label="Email"><a className="underline" href={`mailto:${o.customer_email}`}>{o.customer_email}</a></Detail>
          {o.delivery_address && <Detail label="Deliver to">{o.delivery_address}</Detail>}
          <Detail label="Payment">{o.payment_method}</Detail>
          <Detail label="Placed">{formatPlaced(o.created_at)}</Detail>
          {o.reminder_count > 0 && <Detail label="Reminders sent">{o.reminder_count}</Detail>}
        </dl>
        <ul className="mt-3 border-t border-gray-200 pt-2 text-sm">
          {o.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3 py-0.5">
              <span>
                <strong>{it.qty}×</strong> {itemDisplayName(it)}
                {it.spicyLevel && <> · {it.spicyLevel}</>}
                {it.mods && it.mods.length > 0 && <span className="text-gray-600"> · {it.mods.join(", ")}</span>}
              </span>
              <span className="font-semibold">${Number(it.lineTotal).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {o.special_instructions && (
          <p className="mt-2 rounded-lg bg-[#fff8d8] px-3 py-2 text-sm"><strong>Notes:</strong> {o.special_instructions}</p>
        )}
        {targets.length > 0 && (
          <form action={setOrderTarget} className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3 text-sm">
            <input type="hidden" name="id" value={o.id} />
            <label htmlFor={`target-${o.id}`} className="shrink-0 font-bold">Sales target</label>
            <select
              id={`target-${o.id}`}
              name="target_id"
              defaultValue={o.target_id ?? ""}
              className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-2 py-1"
            >
              <option value="">None</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button className="shrink-0 rounded-full border-2 border-black bg-[#FFD200] px-3 py-1 text-xs font-bold">Save</button>
          </form>
        )}
      </details>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-3">
        {ORDER_STATUSES.map((s) => (
          <form key={s} action={setOrderStatus}>
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="status" value={s} />
            <button
              disabled={s === o.status}
              className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold ${
                s === o.status ? "bg-black text-white" : "bg-white active:bg-[#FFD200]"
              }`}
            >
              {s === "New" ? "New" : s === "Confirmed" ? "Confirm" : s === "Cancelled" ? "Cancel" : s}
            </button>
          </form>
        ))}
      </div>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

// pickup_date is a plain date; format it at UTC noon so it never shifts a day.
function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`)
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function formatPlaced(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
}
