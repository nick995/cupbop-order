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
import TargetsMap from "./TargetsMap";

export const metadata: Metadata = {
  title: "Catering targets — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

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

  const { data, error: loadError } = await getSupabaseServerClient()
    .from("catering_targets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const all = (data ?? []) as CateringTarget[];
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
