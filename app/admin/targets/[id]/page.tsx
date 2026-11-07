import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  directionsUrl,
  ownerOf,
} from "@/lib/targets";
import { deleteActivity, deleteTarget, editActivity, logActivity, updateTargetDetails } from "../../actions";
import { Flash, LinkedOrder, StatusPill, formatWhen, orderTotal, relativeDay, salesOf, storeDate, storeTime } from "../shared";

export const metadata: Metadata = {
  title: "Place — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

const KINDS = [
  { value: "visit", label: "🚶 Visit" },
  { value: "call", label: "📞 Call" },
  { value: "email", label: "✉️ Email" },
  { value: "note", label: "📝 Note" },
] as const;

const OUTCOMES = [
  { value: "", label: "No change" },
  { value: "Follow up", label: "👍 Interested" },
  { value: "Customer", label: "🎉 Customer" },
  { value: "Not interested", label: "👎 Not interested" },
] as const;

const FOLLOW_UPS = [
  { value: "", label: "Keep" },
  { value: "1", label: "Tomorrow" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "none", label: "None" },
] as const;

// Radio buttons styled as chips (no client JS needed).
function Chips({ name, options, defaultValue }: { name: string; options: readonly { value: string; label: string }[]; defaultValue: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-full border-2 border-black bg-white px-3 py-1.5 text-sm font-bold has-[:checked]:bg-black has-[:checked]:text-[#FFD200] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black has-[:focus-visible]:ring-offset-2"
        >
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default async function TargetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const today = storeToday();

  const supabase = getSupabaseServerClient();
  const [{ data: target }, { data: activityRows }, { data: orderRows }] = await Promise.all([
    supabase.from("catering_targets").select("*").eq("id", id).maybeSingle(),
    supabase.from("target_activities").select("*").eq("target_id", id).order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("*").eq("target_id", id).order("pickup_date", { ascending: false }).limit(200),
  ]);
  if (!target) notFound();
  const t = target as CateringTarget;
  const activities = (activityRows ?? []) as TargetActivity[];
  const orders = (orderRows ?? []) as LinkedOrder[];
  // Places marked Visited before visit dates were tracked fall back to the history.
  const lastVisitIso = t.last_visited_at ?? activities.find((a) => a.kind === "visit")?.created_at ?? null;
  const lastVisit = lastVisitIso ? storeDate(lastVisitIso) : null;
  const due = !!t.next_follow_up && t.next_follow_up <= today && t.status !== "Not interested" && t.status !== "Customer";

  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#FFD200] px-4 py-3 sm:px-6">
        <Link href={`/admin/targets?owner=${encodeURIComponent(ownerOf(t))}`} className="text-sm font-bold underline">
          ← {ownerOf(t)}’s places
        </Link>
        <Link href="/admin" className="text-sm font-bold underline">
          Orders
        </Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-16 pt-4 sm:px-6">
        <Flash saved={typeof sp.saved === "string" ? sp.saved : null} error={typeof sp.error === "string" ? sp.error : null} />

        {/* Who / where */}
        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight">{t.name}</h1>
              {t.address && <p className="mt-0.5 text-sm text-gray-600">{t.address}</p>}
              {t.contact_name && <p className="mt-1 text-sm">👤 {t.contact_name}</p>}
            </div>
            <StatusPill status={t.status} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm font-bold">
            <ActionLink href={t.phone ? `tel:${t.phone}` : undefined} label="📞 Call" />
            <ActionLink href={directionsUrl(t)} label="🧭 Directions" external />
            <ActionLink href={t.website ?? undefined} label="🌐 Website" external />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-gray-100 px-2.5 py-1">📋 {ownerOf(t)}’s list</span>
            {(lastVisit || t.status === "To visit") && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1">
                {lastVisit ? `🚶 Last visit ${formatDay(lastVisit)} (${relativeDay(lastVisit, today)})` : "🚶 Not visited yet"}
              </span>
            )}
            {t.next_follow_up && (
              <span className={`rounded-full px-2.5 py-1 ${due ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>
                ⏰ Follow up {formatDay(t.next_follow_up)} ({relativeDay(t.next_follow_up, today)})
              </span>
            )}
          </div>
          {t.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#fff8d8] px-3 py-2 text-sm">{t.notes}</p>}
        </section>

        {/* The one thing you do after a visit or call */}
        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <h2 className="mb-3 text-lg font-extrabold">Log what happened</h2>
          <form action={logActivity} className="space-y-4">
            <input type="hidden" name="id" value={t.id} />
            <Chips name="kind" options={KINDS} defaultValue="visit" />
            <textarea
              name="note"
              rows={3}
              placeholder="Who you talked to, what they need, team size, next step…"
              className="w-full resize-y rounded-xl border-2 border-black px-3 py-2 text-base"
            />
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-600">How did it go?</p>
              <Chips name="outcome" options={OUTCOMES} defaultValue="" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-gray-600">Next follow-up</p>
              <Chips
                name="follow_up_in"
                options={t.next_follow_up ? FOLLOW_UPS : FOLLOW_UPS.filter((f) => f.value !== "")}
                defaultValue={t.next_follow_up ? "" : "7"}
              />
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-600">
                or pick a date
                <input type="date" name="follow_up_date" min={today} className="rounded-lg border-2 border-black px-2 py-1 text-sm" />
              </label>
            </div>
            <button className="w-full rounded-2xl border-2 border-black bg-[#FFD200] py-3 text-base font-extrabold shadow-[0_4px_0_#000] active:translate-y-0.5 active:shadow-none">
              Save
            </button>
          </form>
        </section>

        {/* History */}
        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <h2 className="mb-2 text-lg font-extrabold">History</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-600">Nothing logged yet.</p>
          ) : (
            <ol className="relative ml-2 border-l-2 border-gray-200">
              {activities.map((a) => (
                <li key={a.id} className="mb-4 ml-4 last:mb-0">
                  <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs" aria-hidden="true">
                    {ACTIVITY_LABELS[a.kind].icon}
                  </span>
                  <p className="text-xs text-gray-500">
                    <span className="font-bold text-black">{ACTIVITY_LABELS[a.kind].label}</span>
                    {a.status && (
                      <>
                        {" → "}
                        <span className="font-bold" style={{ color: TARGET_STATUS_COLORS[a.status as keyof typeof TARGET_STATUS_COLORS]?.hex }}>
                          {a.status}
                        </span>
                      </>
                    )}
                    {" · "}
                    {formatWhen(a.created_at)}
                    {a.created_by && ` · ${a.created_by.split("@")[0]}`}
                  </p>
                  {a.note && <p className="mt-0.5 whitespace-pre-wrap text-sm">{a.note}</p>}
                  <details className="group mt-0.5">
                    <summary className="cursor-pointer select-none list-none text-xs text-gray-400 hover:text-black group-open:text-black [&::-webkit-details-marker]:hidden">
                      Edit
                    </summary>
                    <div className="mt-1 rounded-xl border border-gray-300 bg-gray-50 p-3">
                      <form action={editActivity} className="space-y-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="target_id" value={t.id} />
                        {KINDS.some((k) => k.value === a.kind) && <Chips name="kind" options={KINDS} defaultValue={a.kind} />}
                        <textarea
                          name="note"
                          rows={3}
                          defaultValue={a.note ?? ""}
                          aria-label="Note"
                          className="w-full resize-y rounded-xl border-2 border-black bg-white px-3 py-2 text-sm"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            name="date"
                            aria-label="Date"
                            max={today}
                            defaultValue={storeDate(a.created_at)}
                            className="rounded-lg border-2 border-black bg-white px-2 py-1 text-sm"
                          />
                          <input
                            type="time"
                            name="time"
                            aria-label="Time"
                            defaultValue={storeTime(a.created_at)}
                            className="rounded-lg border-2 border-black bg-white px-2 py-1 text-sm"
                          />
                          <button className="ml-auto rounded-full border-2 border-black bg-[#FFD200] px-4 py-1 text-xs font-bold">
                            Save
                          </button>
                        </div>
                      </form>
                      <form action={deleteActivity} className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-300 pt-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="target_id" value={t.id} />
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
                          <input type="checkbox" name="confirm" value="yes" required />
                          Delete this entry
                        </label>
                        <button className="rounded-full border-2 border-black bg-red-600 px-3 py-0.5 text-xs font-bold text-white">
                          Delete
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Orders */}
        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-extrabold">Orders</h2>
            {orders.length > 0 && <span className="text-sm font-bold text-green-800">${salesOf(orders).toFixed(2)} total</span>}
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-600">No orders yet.</p>
          ) : (
            <ul className="mb-3 divide-y divide-gray-100 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex justify-between gap-3 py-1.5">
                  <Link href={`/admin?view=all#order-${o.id}`} className={`underline ${o.status === "Cancelled" ? "text-gray-400 line-through" : ""}`}>
                    {formatDay(o.pickup_date)} · {o.customer_name}
                  </Link>
                  <span className="font-semibold">${orderTotal(o).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/admin/orders/new?${new URLSearchParams({ target: t.id })}`}
            className="mt-2 block rounded-xl border-2 border-black py-2 text-center text-sm font-bold active:bg-[#FFD200]"
          >
            + New order for {t.name}
          </Link>
        </section>

        {/* Edit */}
        <details className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <summary className="cursor-pointer select-none text-lg font-extrabold">Edit details</summary>
          <form action={updateTargetDetails} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Name" name="name" defaultValue={t.name} required className="sm:col-span-2" />
            <Field label="Contact person" name="contact_name" defaultValue={t.contact_name} />
            <Field label="Phone" name="phone" type="tel" defaultValue={t.phone} />
            <Field label="Address" name="address" defaultValue={t.address} className="sm:col-span-2" />
            <Field label="Website" name="website" defaultValue={t.website} className="sm:col-span-2" />
            <label className="block">
              <span className="mb-1 block text-xs font-bold">Status</span>
              <select name="status" defaultValue={t.status} className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm">
                {TARGET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold">On whose list</span>
              <select name="owner" defaultValue={ownerOf(t)} className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm">
                {[...new Set([...STAFF.map((p) => p.name as string), ownerOf(t)])].map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <Field label="Next follow-up (clear to remove)" name="next_follow_up" type="date" defaultValue={t.next_follow_up} />
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">About this place (always shown at the top)</span>
              <textarea name="notes" rows={3} defaultValue={t.notes ?? ""} className="w-full resize-y rounded-xl border-2 border-black px-3 py-2 text-sm" />
            </label>
            <button className="rounded-xl border-2 border-black bg-[#FFD200] py-2 text-sm font-bold sm:col-span-2">Save details</button>
          </form>
          <details className="mt-4 border-t border-gray-200 pt-3">
            <summary className="cursor-pointer select-none text-xs font-semibold text-red-600 underline">Remove this place</summary>
            <form action={deleteTarget} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
              <input type="hidden" name="id" value={t.id} />
              <span className="text-xs text-red-900">Deletes the place and its history. Orders stay but lose the link.</span>
              <button className="ml-auto rounded-full border-2 border-red-700 bg-red-600 px-3 py-1 text-xs font-bold text-white">
                Yes, remove
              </button>
            </form>
          </details>
        </details>
      </main>
    </div>
  );
}

function ActionLink({ href, label, external }: { href?: string; label: string; external?: boolean }) {
  if (!href) {
    return <span className="rounded-xl border-2 border-gray-200 py-2 text-gray-300">{label}</span>;
  }
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      className="rounded-xl border-2 border-black py-2 active:bg-[#FFD200]"
    >
      {label}
    </a>
  );
}

function Field({
  label,
  className = "",
  defaultValue,
  ...props
}: { label: string; className?: string; defaultValue?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue">) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input {...props} defaultValue={defaultValue ?? ""} className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm" />
    </label>
  );
}
