// Signed confirm links + reminder timing for unconfirmed ("New") orders.

import { createHmac, timingSafeEqual } from "crypto";

export const STORE_TIME_ZONE = "America/Denver";

// Matches the check constraint in db/schema.sql.
export const ORDER_STATUSES = ["New", "Confirmed", "Ready", "Completed", "Cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Today's date in the store's time zone, as YYYY-MM-DD.
export function storeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(now);
}

// Reminder cadence: every 24h while the order is more than 48h away,
// every 12h once it's within 48h. Stops when the order time has passed.
export const NEAR_WINDOW_HOURS = 48;
export const FAR_INTERVAL_HOURS = 24;
export const NEAR_INTERVAL_HOURS = 12;

// ---------- Confirm links ----------

function sign(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`confirm:${orderId}`).digest("hex");
}

export function confirmUrlFor(orderId: string, origin: string): string | undefined {
  const secret = process.env.ORDER_ACTION_SECRET;
  if (!secret) {
    console.warn("[orders] ORDER_ACTION_SECRET missing — emails go out without a Confirm button.");
    return undefined;
  }
  const base = process.env.SITE_URL || origin;
  const params = new URLSearchParams({ id: orderId, t: sign(orderId, secret) });
  return `${base.replace(/\/$/, "")}/orders/confirm?${params}`;
}

export function verifyConfirmToken(orderId: string, token: string): boolean {
  const secret = process.env.ORDER_ACTION_SECRET;
  if (!secret || !orderId || !token) return false;
  const expected = Buffer.from(sign(orderId, secret), "hex");
  const given = Buffer.from(token, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- Time helpers ----------

// Offset (ms) of `timeZone` from UTC at the given instant.
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// Store-local pickup date ("2026-11-06") + time ("12:00" or "12:00:00") → instant.
export function orderInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let ts = wall - tzOffsetMs(new Date(wall), STORE_TIME_ZONE);
  // Re-check once in case the guess landed on the other side of a DST switch.
  ts = wall - tzOffsetMs(new Date(ts), STORE_TIME_ZONE);
  return new Date(ts);
}

const HOUR = 60 * 60 * 1000;
// The scheduler runs hourly and can start a bit late; allow some slack so
// reminders don't drift an hour later each cycle.
const SLACK_MS = 15 * 60 * 1000;

export function reminderDue(
  orderAt: Date,
  lastNotifiedAt: Date | null,
  now: Date = new Date()
): { due: boolean; hoursUntil: number } {
  const msUntil = orderAt.getTime() - now.getTime();
  const hoursUntil = Math.max(0, Math.round(msUntil / HOUR));
  if (msUntil <= 0) return { due: false, hoursUntil };
  if (!lastNotifiedAt) return { due: true, hoursUntil };

  const intervalHours = msUntil <= NEAR_WINDOW_HOURS * HOUR ? NEAR_INTERVAL_HOURS : FAR_INTERVAL_HOURS;
  const since = now.getTime() - lastNotifiedAt.getTime();
  return { due: since >= intervalHours * HOUR - SLACK_MS, hoursUntil };
}
