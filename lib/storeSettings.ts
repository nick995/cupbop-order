// Order availability rules staff control from /admin/settings:
// - leadDays: minimum notice. 3 means an order placed today can be for
//   today + 3 days or later.
// - blackoutDates: specific dates the store won't take orders for.
// Stored in the single-row public.store_settings table.

import { getSupabaseServerClient } from "@/lib/supabase";
import { storeToday } from "@/lib/orderActions";

export interface StoreSettings {
  leadDays: number;
  blackoutDates: string[]; // YYYY-MM-DD, sorted
}

export const DEFAULT_SETTINGS: StoreSettings = { leadDays: 0, blackoutDates: [] };
export const MAX_LEAD_DAYS = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

// Falls back to defaults (no restrictions) if the table is missing or the DB
// is unreachable, so ordering never breaks because of this feature.
export async function getStoreSettings(): Promise<StoreSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return DEFAULT_SETTINGS;
  }
  const { data, error } = await getSupabaseServerClient()
    .from("store_settings")
    .select("lead_days, blackout_dates")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("[settings] load failed, using defaults", error);
    return DEFAULT_SETTINGS;
  }
  if (!data) return DEFAULT_SETTINGS;
  return {
    leadDays: Number(data.lead_days) || 0,
    blackoutDates: ((data.blackout_dates as string[] | null) ?? []).slice().sort(),
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function earliestOrderDate(settings: StoreSettings, today = storeToday()): string {
  return addDays(today, settings.leadDays);
}

// Returns a customer-facing reason if the date can't be ordered, else null.
export function dateUnavailableReason(
  date: string,
  settings: StoreSettings,
  today = storeToday()
): string | null {
  if (!isIsoDate(date)) return "Please choose a valid date.";
  const earliest = earliestOrderDate(settings, today);
  if (date < earliest) {
    return settings.leadDays > 0
      ? `Orders need at least ${settings.leadDays} day${settings.leadDays === 1 ? "" : "s"} notice. The earliest available date is ${formatDay(earliest)}.`
      : "Please choose today or a future date.";
  }
  if (settings.blackoutDates.includes(date)) {
    return `We're not taking orders for ${formatDay(date)}. Please choose another date.`;
  }
  return null;
}

// Plain dates are formatted at UTC noon so they never shift a day.
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
