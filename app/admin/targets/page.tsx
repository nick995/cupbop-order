import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import {
  CateringTarget,
  TARGET_STATUSES,
  TARGET_STATUS_COLORS,
  directionsUrl,
} from "@/lib/targets";
import { deleteTarget, updateTarget } from "../actions";
import { formatDay } from "@/lib/storeSettings";
import TargetsMap from "./TargetsMap";

export const metadata: Metadata = {
  title: "Catering targets — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

interface LinkedOrder {
  id: string;
  target_id: string;
  customer_name: string;
  pickup_date: string;
  subtotal: number;
  status: string;
}

function TargetOrders({ orders, sales }: { orders: LinkedOrder[]; sales: number }) {
  if (orders.length === 0) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        No orders yet. Link one from its order card on the Orders page (Details → Sales target).
      </p>
    );
  }
  const counted = orders.filter((o) => o.status !== "Cancelled").length;
  return (
    <details className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none font-bold text-green-900">
        {counted} order{counted === 1 ? "" : "s"} · ${sales.toFixed(2)} · last {formatDay(orders[0].pickup_date)}
      </summary>
      <ul className="mt-1 space-y-0.5">
        {orders.map((o) => (
          <li key={o.id} className="flex justify-between gap-3">
            <Link href={`/admin?view=all#order-${o.id}`} className={`underline ${o.status === "Cancelled" ? "text-gray-400 line-through" : ""}`}>
              {formatDay(o.pickup_date)} · {o.customer_name}
            </Link>
            <span className="font-semibold">${Number(o.subtotal).toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;
  const statusFilter = TARGET_STATUSES.find((s) => s === params.status);

  const supabase = getSupabaseServerClient();
  const [{ data, error: loadError }, { data: orderRows }] = await Promise.all([
    supabase.from("catering_targets").select("*").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("orders")
      .select("id, target_id, customer_name, pickup_date, subtotal, status")
      .not("target_id", "is", null)
      .order("pickup_date", { ascending: false })
      .limit(1000),
  ]);
  const all = (data ?? []) as CateringTarget[];

  // Orders credited to each target. Cancelled orders are listed but not counted in sales.
  const ordersByTarget = new Map<string, LinkedOrder[]>();
  for (const o of (orderRows ?? []) as LinkedOrder[]) {
    ordersByTarget.set(o.target_id, [...(ordersByTarget.get(o.target_id) ?? []), o]);
  }
  const salesOf = (list: LinkedOrder[] = []) =>
    list.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + Number(o.subtotal), 0);
  const totalSales = salesOf((orderRows ?? []) as LinkedOrder[]);
  const totalOrders = ((orderRows ?? []) as LinkedOrder[]).filter((o) => o.status !== "Cancelled").length;
  const targets = statusFilter ? all.filter((t) => t.status === statusFilter) : all;
  const counts = Object.fromEntries(TARGET_STATUSES.map((s) => [s, all.filter((t) => t.status === s).length]));

  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#FFD200] px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Cupbop Park City</p>
          <h1 className="text-xl font-extrabold">Catering targets</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold underline">
            Home
          </Link>
          <Link href="/admin" className="text-sm font-bold underline">
            ← Orders
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        {saved && (
          <p className="mb-4 rounded-xl border-2 border-black bg-green-100 px-4 py-3 text-sm font-bold text-green-900">{saved}</p>
        )}
        {(error || loadError) && (
          <p className="mb-4 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-bold text-red-900">
            {error ?? "Could not load the list. Make sure db/schema.sql has been run in Supabase."}
          </p>
        )}

        {totalOrders > 0 && (
          <p className="mb-4 rounded-xl border-2 border-black bg-white px-4 py-3 text-sm">
            Sales from targets: <strong>${totalSales.toFixed(2)}</strong> across <strong>{totalOrders}</strong> order
            {totalOrders === 1 ? "" : "s"}
          </p>
        )}

        <TargetsMap apiKey={process.env.GOOGLE_MAPS_API_KEY || null} targets={targets} />

        <nav className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href="/admin/targets"
            className={`rounded-full border border-black px-3 py-1 text-xs font-bold ${!statusFilter ? "bg-black text-white" : "bg-white"}`}
          >
            All ({all.length})
          </Link>
          {TARGET_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/targets?${new URLSearchParams({ status: s })}`}
              className={`rounded-full border border-black px-3 py-1 text-xs font-bold ${statusFilter === s ? "bg-black text-white" : "bg-white"}`}
            >
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TARGET_STATUS_COLORS[s].hex }} />
              {s} ({counts[s]})
            </Link>
          ))}
        </nav>

        {targets.length === 0 && !loadError && (
          <p className="py-10 text-center text-sm text-gray-600">No places here yet.</p>
        )}

        <ul className="space-y-3">
          {targets.map((t) => (
            <li
              key={t.id}
              id={`target-${t.id}`}
              className="scroll-mt-20 rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-extrabold">{t.name}</p>
                  {t.address && <p className="text-sm text-gray-600">{t.address}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <a className="font-bold underline" href={directionsUrl(t)} target="_blank" rel="noopener">
                      Directions
                    </a>
                    {t.phone && (
                      <a className="underline" href={`tel:${t.phone}`}>
                        {t.phone}
                      </a>
                    )}
                    {t.website && (
                      <a className="underline" href={t.website} target="_blank" rel="noopener noreferrer">
                        Website
                      </a>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${TARGET_STATUS_COLORS[t.status].badge}`}>
                  {t.status}
                </span>
              </div>

              <TargetOrders orders={ordersByTarget.get(t.id) ?? []} sales={salesOf(ordersByTarget.get(t.id))} />

              <form action={updateTarget} className="mt-3">
                <input type="hidden" name="id" value={t.id} />
                <textarea
                  name="notes"
                  defaultValue={t.notes ?? ""}
                  rows={2}
                  placeholder="Notes"
                  className="w-full resize-none rounded-xl border-2 border-gray-300 px-3 py-2 text-sm focus:border-black"
                />
                <button className="mt-1 text-xs font-bold underline">Save notes</button>
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {TARGET_STATUSES.map((s) => (
                  <form key={s} action={updateTarget}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      disabled={s === t.status}
                      className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold ${
                        s === t.status ? "bg-black text-white" : "bg-white active:bg-[#FFD200]"
                      }`}
                    >
                      {s}
                    </button>
                  </form>
                ))}
                <form action={deleteTarget} className="ml-auto">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs font-semibold text-red-600 underline">Remove</button>
                </form>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Updated {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" })}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
