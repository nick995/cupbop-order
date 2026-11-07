import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import {
  ACTIVITY_LABELS,
  CateringTarget,
  TARGET_STATUSES,
  TARGET_STATUS_COLORS,
  TargetActivity,
  directionsUrl,
} from "@/lib/targets";
import { STORE_TIME_ZONE, storeToday } from "@/lib/orderActions";
import { deleteTarget, logActivity, updateTarget, updateTargetDetails } from "../actions";
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
  discount?: number | null; // missing until the discount column exists
  status: string;
}

const orderTotal = (o: LinkedOrder) => Number(o.subtotal) - Number(o.discount ?? 0);

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
            <span className="font-semibold">${orderTotal(o).toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Day difference between two YYYY-MM-DD dates (b - a).
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

function storeDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(new Date(iso));
}

function relativeDay(date: string, today: string): string {
  const d = daysBetween(date, today);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  return d > 0 ? `${d} days ago` : `in ${-d} days`;
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(iso));
}

type Filter = (typeof TARGET_STATUSES)[number] | "due";

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter: Filter | undefined =
    params.status === "due" ? "due" : TARGET_STATUSES.find((s) => s === params.status);
  const today = storeToday();

  const supabase = getSupabaseServerClient();
  const [{ data, error: loadError }, { data: orderRows }, { data: activityRows }] = await Promise.all([
    supabase.from("catering_targets").select("*").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("orders")
      .select("*")
      .not("target_id", "is", null)
      .order("pickup_date", { ascending: false })
      .limit(1000),
    supabase.from("target_activities").select("*").order("created_at", { ascending: false }).limit(3000),
  ]);
  const all = (data ?? []) as CateringTarget[];

  const ordersByTarget = new Map<string, LinkedOrder[]>();
  for (const o of (orderRows ?? []) as LinkedOrder[]) {
    ordersByTarget.set(o.target_id, [...(ordersByTarget.get(o.target_id) ?? []), o]);
  }
  const activitiesByTarget = new Map<string, TargetActivity[]>();
  for (const a of (activityRows ?? []) as TargetActivity[]) {
    activitiesByTarget.set(a.target_id, [...(activitiesByTarget.get(a.target_id) ?? []), a]);
  }
  // Cancelled orders are listed but not counted in sales.
  const salesOf = (list: LinkedOrder[] = []) =>
    list.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + orderTotal(o), 0);
  const allLinked = (orderRows ?? []) as LinkedOrder[];
  const totalSales = salesOf(allLinked);

  const isDue = (t: CateringTarget) =>
    !!t.next_follow_up && t.next_follow_up <= today && t.status !== "Not interested";
  const dueCount = all.filter(isDue).length;
  const visitsThisWeek = ((activityRows ?? []) as TargetActivity[]).filter(
    (a) => a.kind === "visit" && daysBetween(storeDate(a.created_at), today) < 7
  ).length;

  const needle = q.toLowerCase();
  const targets = all
    .filter((t) => (filter === "due" ? isDue(t) : filter ? t.status === filter : true))
    .filter(
      (t) =>
        !needle ||
        [t.name, t.address, t.contact_name, t.notes, t.phone].some((v) => v?.toLowerCase().includes(needle))
    )
    // Due follow-ups first (oldest first), then most recently updated.
    .sort((a, b) => {
      const ad = isDue(a), bd = isDue(b);
      if (ad !== bd) return ad ? -1 : 1;
      if (ad && bd) return a.next_follow_up!.localeCompare(b.next_follow_up!);
      return b.updated_at.localeCompare(a.updated_at);
    });

  const chip = (value: Filter | undefined, label: React.ReactNode) => {
    const p = new URLSearchParams();
    if (value) p.set("status", value);
    if (q) p.set("q", q);
    const qs = p.toString();
    return (
      <Link
        key={value ?? "all"}
        href={qs ? `/admin/targets?${qs}` : "/admin/targets"}
        className={`rounded-full border border-black px-3 py-1 text-xs font-bold ${filter === value ? "bg-black text-white" : "bg-white"}`}
      >
        {label}
      </Link>
    );
  };

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

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="To visit" value={all.filter((t) => t.status === "To visit").length} />
          <Stat label="Follow-ups due" value={dueCount} alert={dueCount > 0} href="/admin/targets?status=due" />
          <Stat label="Visits this week" value={visitsThisWeek} />
          <Stat label="Sales from targets" value={`$${totalSales.toFixed(0)}`} />
        </div>

        <TargetsMap apiKey={process.env.GOOGLE_MAPS_API_KEY || null} targets={targets} />

        <form className="mb-3 flex gap-2" action="/admin/targets">
          {filter && <input type="hidden" name="status" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, contact, address, notes…"
            className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-bold">Search</button>
        </form>

        <nav className="mb-4 flex flex-wrap gap-1.5">
          {chip(undefined, `All (${all.length})`)}
          {chip("due", <span className={dueCount ? "text-red-600" : ""}>⏰ Follow-up due ({dueCount})</span>)}
          {TARGET_STATUSES.map((s) =>
            chip(
              s,
              <>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TARGET_STATUS_COLORS[s].hex }} />
                {s} ({all.filter((t) => t.status === s).length})
              </>
            )
          )}
        </nav>

        {targets.length === 0 && !loadError && (
          <p className="py-10 text-center text-sm text-gray-600">{q ? `Nothing matches "${q}".` : "No places here yet."}</p>
        )}

        <ul className="space-y-3">
          {targets.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              today={today}
              due={isDue(t)}
              orders={ordersByTarget.get(t.id) ?? []}
              sales={salesOf(ordersByTarget.get(t.id))}
              activities={activitiesByTarget.get(t.id) ?? []}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

function Stat({ label, value, alert, href }: { label: string; value: React.ReactNode; alert?: boolean; href?: string }) {
  const body = (
    <>
      <p className={`text-xl font-extrabold ${alert ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
    </>
  );
  const cls = `block rounded-xl border-2 border-black px-3 py-2 ${alert ? "bg-red-50" : "bg-white"}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

function TargetCard({
  target: t,
  today,
  due,
  orders,
  sales,
  activities,
}: {
  target: CateringTarget;
  today: string;
  due: boolean;
  orders: LinkedOrder[];
  sales: number;
  activities: TargetActivity[];
}) {
  const lastVisit = t.last_visited_at ? storeDate(t.last_visited_at) : null;
  const visits = activities.filter((a) => a.kind === "visit").length;

  return (
    <li
      id={`target-${t.id}`}
      className={`scroll-mt-20 rounded-2xl border-2 bg-white p-4 shadow-[0_3px_0_#000] ${due ? "border-red-600" : "border-black"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-extrabold">{t.name}</p>
          {t.address && <p className="text-sm text-gray-600">{t.address}</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {t.contact_name && <span>👤 {t.contact_name}</span>}
            {t.phone && (
              <a className="underline" href={`tel:${t.phone}`}>
                {t.phone}
              </a>
            )}
            <a className="font-bold underline" href={directionsUrl(t)} target="_blank" rel="noopener">
              Directions
            </a>
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

      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-gray-100 px-2.5 py-1">
          🚶 {lastVisit ? `Last visit ${formatDay(lastVisit)} (${relativeDay(lastVisit, today)})` : "Never visited"}
          {visits > 1 && ` · ${visits} visits`}
        </span>
        {t.next_follow_up && (
          <span className={`rounded-full px-2.5 py-1 ${due ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>
            ⏰ Follow up {formatDay(t.next_follow_up)} ({relativeDay(t.next_follow_up, today)})
          </span>
        )}
      </div>

      {t.notes && <p className="mt-2 rounded-lg bg-[#fff8d8] px-3 py-2 text-sm">{t.notes}</p>}

      {/* Quick log: the main thing you do after walking out of a place. */}
      <form action={logActivity} className="mt-3 rounded-xl border border-gray-300 p-3">
        <input type="hidden" name="id" value={t.id} />
        <textarea
          name="note"
          rows={2}
          placeholder="Visit notes: who you talked to, what they need, team size, next step…"
          className="w-full resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-black"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-bold">
            Next follow-up
            <input type="date" name="next_follow_up" min={today} className="rounded-lg border-2 border-black px-2 py-1 text-xs" />
          </label>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button name="kind" value="visit" className="rounded-full border-2 border-black bg-[#FFD200] px-3 py-1 text-xs font-extrabold">
              🚶 Log visit
            </button>
            <button name="kind" value="call" className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold">
              📞 Call
            </button>
            <button name="kind" value="email" className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold">
              ✉️ Email
            </button>
            <button name="kind" value="note" className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold">
              📝 Note
            </button>
          </div>
        </div>
      </form>

      {activities.length > 0 && <ActivityList activities={activities} />}

      <TargetOrders orders={orders} sales={sales} />
      <Link href={`/admin/orders/new?${new URLSearchParams({ target: t.id })}`} className="mt-2 inline-block text-xs font-bold underline">
        + New order for {t.name}
      </Link>

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
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer select-none text-xs font-bold text-gray-600 underline">Edit details</summary>
        <form action={updateTargetDetails} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input type="hidden" name="id" value={t.id} />
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Contact person</span>
            <input name="contact_name" defaultValue={t.contact_name ?? ""} className="w-full rounded-lg border-2 border-black px-2 py-1.5" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Phone</span>
            <input name="phone" type="tel" defaultValue={t.phone ?? ""} className="w-full rounded-lg border-2 border-black px-2 py-1.5" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Next follow-up (clear to remove)</span>
            <input name="next_follow_up" type="date" defaultValue={t.next_follow_up ?? ""} className="w-full rounded-lg border-2 border-black px-2 py-1.5" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">About this place (always shown)</span>
            <textarea name="notes" rows={2} defaultValue={t.notes ?? ""} className="w-full resize-none rounded-lg border-2 border-black px-2 py-1.5" />
          </label>
          <button className="rounded-full border-2 border-black bg-[#FFD200] px-4 py-1.5 text-xs font-bold sm:col-span-2">Save details</button>
        </form>
        <form action={deleteTarget} className="mt-3 text-right">
          <input type="hidden" name="id" value={t.id} />
          <button className="text-xs font-semibold text-red-600 underline">Remove this place</button>
        </form>
      </details>
    </li>
  );
}

function ActivityList({ activities }: { activities: TargetActivity[] }) {
  const row = (a: TargetActivity) => {
    const { icon, label } = ACTIVITY_LABELS[a.kind];
    return (
      <li key={a.id} className="flex gap-2 py-1">
        <span aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            <span className="font-bold text-black">{a.kind === "status" ? `Marked ${a.status}` : label}</span> · {formatWhen(a.created_at)}
            {a.created_by && ` · ${a.created_by.split("@")[0]}`}
          </p>
          {a.note && <p className="whitespace-pre-wrap text-sm">{a.note}</p>}
        </div>
      </li>
    );
  };
  const [recent, older] = [activities.slice(0, 3), activities.slice(3)];
  return (
    <div className="mt-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-gray-600">History</p>
      <ul className="divide-y divide-gray-100">{recent.map(row)}</ul>
      {older.length > 0 && (
        <details>
          <summary className="cursor-pointer select-none text-xs font-bold text-gray-600 underline">
            Show {older.length} older
          </summary>
          <ul className="divide-y divide-gray-100">{older.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
