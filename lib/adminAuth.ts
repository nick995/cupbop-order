// Admin session for /admin. Passwords are checked by Supabase Auth; after a
// successful login we set our own signed, httpOnly cookie. Every request
// re-checks the email against ADMIN_EMAILS, so removing someone from that list
// locks them out immediately.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "cupbop_admin";
export const SESSION_DAYS = 7;

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdmin(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

function secret(): string {
  // Reuses the confirm-link secret with a separate prefix so no extra env var is needed.
  const s = process.env.ORDER_ACTION_SECRET;
  if (!s) throw new Error("ORDER_ACTION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`admin-session:${payload}`).digest("base64url");
}

export function createSessionValue(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), exp: Date.now() + SESSION_DAYS * 86_400_000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { e, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof e !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return isAllowedAdmin(e) ? e : null;
  } catch {
    return null;
  }
}

export async function getAdminEmail(): Promise<string | null> {
  const store = await cookies();
  return readSession(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) redirect("/admin/login");
  return email;
}
