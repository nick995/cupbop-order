import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { storeToday } from "@/lib/orderActions";
import { MAX_LEAD_DAYS, earliestOrderDate, formatDay, getStoreSettings } from "@/lib/storeSettings";
import { addBlackoutDates, removeBlackoutDate, setLeadDays } from "../actions";

export const metadata: Metadata = {
  title: "Order availability — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const error = typeof params.error === "string" ? params.error : null;

  const settings = await getStoreSettings();
  const today = storeToday();
  const earliest = earliestOrderDate(settings, today);
  const upcomingBlackouts = settings.blackoutDates.filter((d) => d >= today);

  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#FFD200] px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Cupbop Park City</p>
          <h1 className="text-xl font-extrabold">Order availability</h1>
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

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-4 sm:px-6">
        {saved && (
          <p className="rounded-xl border-2 border-black bg-green-100 px-4 py-3 text-sm font-bold text-green-900">{saved}</p>
        )}
        {error && (
          <p className="rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{error}</p>
        )}

        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <h2 className="text-lg font-extrabold">Minimum notice</h2>
          <p className="mt-1 text-sm text-gray-600">
            How many days ahead customers must order. 0 allows same-day orders.
          </p>
          <form action={setLeadDays} className="mt-3 flex items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold">Days</span>
              <input
                type="number"
                name="lead_days"
                min={0}
                max={MAX_LEAD_DAYS}
                step={1}
                required
                defaultValue={settings.leadDays}
                className="w-24 rounded-xl border-2 border-black px-3 py-2 text-base font-bold"
              />
            </label>
            <button className="rounded-xl border-2 border-black bg-[#FFD200] px-4 py-2 text-sm font-bold shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-none">
              Save
            </button>
          </form>
          <p className="mt-3 text-sm">
            Today is <strong>{formatDay(today)}</strong>. Customers can order for{" "}
            <strong>{formatDay(earliest)}</strong> or later.
          </p>
        </section>

        <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
          <h2 className="text-lg font-extrabold">Blackout dates</h2>
          <p className="mt-1 text-sm text-gray-600">
            Dates customers can&apos;t pick. Leave &quot;To&quot; empty to block a single day.
          </p>
          <form action={addBlackoutDates} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold">From</span>
              <input
                type="date"
                name="from"
                min={today}
                required
                className="rounded-xl border-2 border-black px-3 py-2 text-base"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold">To (optional)</span>
              <input type="date" name="to" min={today} className="rounded-xl border-2 border-black px-3 py-2 text-base" />
            </label>
            <button className="rounded-xl border-2 border-black bg-[#FFD200] px-4 py-2 text-sm font-bold shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-none">
              Block
            </button>
          </form>

          {upcomingBlackouts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">No blackout dates.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 border-t border-gray-200">
              {upcomingBlackouts.map((d) => (
                <li key={d} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-semibold">{formatDay(d)}, {d.slice(0, 4)}</span>
                  <form action={removeBlackoutDate}>
                    <input type="hidden" name="date" value={d} />
                    <button className="rounded-full border-2 border-black px-3 py-1 text-xs font-bold active:bg-[#FFD200]">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
