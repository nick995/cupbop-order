import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { storeToday } from "@/lib/orderActions";
import { formatDay } from "@/lib/storeSettings";
import {
  ACTIVITY_LABELS,
  CateringTarget,
  STAFF,
  TARGET_STATUSES,
  TARGET_STATUS_COLORS,
  TargetActivity,
  ownerOf,
  staffName,
} from "@/lib/targets";
import TargetsMap from "./TargetsMap";
import { Flash, LinkedOrder, StatusPill, daysBetween, relativeDay, salesOf, storeDate } from "./shared";

export const metadata: Metadata = {
  title: "Catering targets — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

type Filter = (typeof TARGET_STATUSES)[number] | "due";

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const adminEmail = await requireAdmin();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filter: Filter | undefined =
    params.status === "due" ? "due" : TARGET_STATUSES.find((s) => s === params.status);
  const today = storeToday();
  const me = staffName(adminEmail);
  // Whose list: defaults to the signed-in person; "all" shows everyone's.
  const owner = typeof params.owner === "string" && params.owner ? params.owner : me;

  const supabase = getSupabaseServerClient();
  const [{ data, error: loadError }, { data: orderRows }, { data: activityRows }] = await Promise.all([
    supabase.from("catering_targets").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("*").not("target_id", "is", null).limit(2000),
    supabase.from("target_activities").select("*").order("created_at", { ascending: false }).limit(3000),
  ]);
  const everyone = (data ?? []) as CateringTarget[];
  const owners = [...new Set([...STAFF.map((s) => s.name as string), me, ...everyone.map(ownerOf)])];
  const all = owner === "all" ? everyone : everyone.filter((t) => ownerOf(t) === owner);
  const inList = new Set(all.map((t) => t.id));
  const activities = ((activityRows ?? []) as TargetActivity[]).filter((a) => inList.has(a.target_id));
  const listOrders = ((orderRows ?? []) as LinkedOrder[]).filter((o) => inList.has(o.target_id));

  const ordersByTarget = new Map<string, LinkedOrder[]>();
  for (const o of listOrders) {
    ordersByTarget.set(o.target_id, [...(ordersByTarget.get(o.target_id) ?? []), o]);
  }
  const lastActivity = new Map<string, TargetActivity>();
  const lastVisitActivity = new Map<string, string>();
  for (const a of activities) {
    if (!lastActivity.has(a.target_id)) lastActivity.set(a.target_id, a);
    if (a.kind === "visit" && !lastVisitActivity.has(a.target_id)) lastVisitActivity.set(a.target_id, a.created_at);
  }

  const isDue = (t: CateringTarget) =>
    !!t.next_follow_up && t.next_follow_up <= today && t.status !== "Not interested" && t.status !== "Customer";
  const dueCount = all.filter(isDue).length;
  const visitsThisWeek = activities.filter(
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
    // Due follow-ups first (oldest first), then upcoming follow-ups, then most recently touched.
    .sort((a, b) => {
      const ad = isDue(a), bd = isDue(b);
      if (ad !== bd) return ad ? -1 : 1;
      if (a.next_follow_up && b.next_follow_up) return a.next_follow_up.localeCompare(b.next_follow_up);
      if (!!a.next_follow_up !== !!b.next_follow_up) return a.next_follow_up ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    });

  const listUrl = (over: { owner?: string; status?: string }) => {
    const p = new URLSearchParams();
    const o = over.owner ?? owner;
    if (o !== me) p.set("owner", o);
    if (over.status) p.set("status", over.status);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/admin/targets?${qs}` : "/admin/targets";
  };

  const chip = (value: Filter | undefined, label: React.ReactNode) => {
    return (
      <Link
        key={value ?? "all"}
        href={listUrl({ status: value })}
        className={`shrink-0 rounded-full border border-black px-3 py-1 text-xs font-bold ${filter === value ? "bg-black text-white" : "bg-white"}`}
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
          <h1 className="text-xl font-extrabold">{owner === "all" ? "Everyone’s targets" : `${owner}’s targets`}</h1>
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
        <Flash saved={saved} error={error ?? (loadError ? "Could not load the list. Make sure db/schema.sql has been run in Supabase." : null)} />

        <nav aria-label="Whose list" className="mb-4 flex rounded-full border-2 border-black bg-white p-1 text-sm font-extrabold">
          {[...owners, "all"].map((o) => (
            <Link
              key={o}
              href={listUrl({ owner: o, status: filter })}
              aria-current={o === owner ? "page" : undefined}
              className={`flex-1 rounded-full px-3 py-1.5 text-center ${o === owner ? "bg-black text-[#FFD200]" : ""}`}
            >
              {o === "all" ? "Everyone" : o}
              <span className="ml-1 font-semibold opacity-70">
                {o === "all" ? everyone.length : everyone.filter((t) => ownerOf(t) === o).length}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mb-4 grid grid-cols-4 gap-2 text-center">
          <Stat label="To visit" value={all.filter((t) => t.status === "To visit").length} />
          <Stat label="Due" value={dueCount} alert={dueCount > 0} href={listUrl({ status: "due" })} />
          <Stat label="Visits / wk" value={visitsThisWeek} />
          <Stat label="Sales" value={`$${salesOf(listOrders).toFixed(0)}`} />
        </div>

        <TargetsMap apiKey={process.env.GOOGLE_MAPS_API_KEY || null} targets={targets} owner={owner === "all" ? me : owner} />

        <form className="mb-3 flex gap-2" action="/admin/targets">
          {owner !== me && <input type="hidden" name="owner" value={owner} />}
          {filter && <input type="hidden" name="status" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search places, contacts, notes…"
            className="min-w-0 flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-bold">Search</button>
        </form>

        <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {chip(undefined, `All ${all.length}`)}
          {chip("due", <span className={dueCount && filter !== "due" ? "text-red-600" : ""}>⏰ Due {dueCount}</span>)}
          {TARGET_STATUSES.map((s) =>
            chip(
              s,
              <>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: TARGET_STATUS_COLORS[s].hex }} />
                {s} {all.filter((t) => t.status === s).length}
              </>
            )
          )}
        </nav>

        {targets.length === 0 && !loadError && (
          <p className="py-10 text-center text-sm text-gray-600">{q ? `Nothing matches "${q}".` : "No places here yet."}</p>
        )}

        {targets.length > 0 && (
          <ul className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[0_3px_0_#000]">
            {targets.map((t) => {
              const due = isDue(t);
              const last = lastActivity.get(t.id);
              const orders = ordersByTarget.get(t.id) ?? [];
              const lastVisitIso = t.last_visited_at ?? lastVisitActivity.get(t.id) ?? null;
              const lastVisit = lastVisitIso ? storeDate(lastVisitIso) : null;
              return (
                <li key={t.id} className="border-b border-gray-200 last:border-b-0">
                  <Link href={`/admin/targets/${t.id}`} className={`block px-4 py-3 hover:bg-yellow-50 ${due ? "bg-red-50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate font-extrabold">
                        {t.name}
                        {owner === "all" && <span className="ml-2 text-xs font-semibold text-gray-500">{ownerOf(t)}</span>}
                      </p>
                      <StatusPill status={t.status} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                      {t.next_follow_up && t.status !== "Not interested" && (
                        <span className={due ? "font-bold text-red-600" : "font-semibold text-amber-700"}>
                          ⏰ {formatDay(t.next_follow_up)} ({relativeDay(t.next_follow_up, today)})
                        </span>
                      )}
                      {lastVisit ? (
                        <span>🚶 Visited {relativeDay(lastVisit, today)}</span>
                      ) : (
                        t.status === "To visit" && <span>Not visited yet</span>
                      )}
                      {orders.length > 0 && (
                        <span className="font-semibold text-green-800">
                          🧾 {orders.length} · ${salesOf(orders).toFixed(0)}
                        </span>
                      )}
                    </p>
                    {last?.note && (
                      <p className="mt-1 truncate text-sm text-gray-800">
                        {ACTIVITY_LABELS[last.kind].icon} {last.note}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, alert, href }: { label: string; value: React.ReactNode; alert?: boolean; href?: string }) {
  const body = (
    <>
      <p className={`text-lg font-extrabold leading-tight ${alert ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
    </>
  );
  const cls = `block rounded-xl border-2 border-black px-2 py-1.5 ${alert ? "bg-red-50" : "bg-white"}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
