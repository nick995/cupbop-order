"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ORDER_STATUSES, storeToday } from "@/lib/orderActions";
import { MAX_LEAD_DAYS, addDays, getStoreSettings, isIsoDate } from "@/lib/storeSettings";
import {
  ADMIN_COOKIE,
  SESSION_DAYS,
  createSessionValue,
  isAllowedAdmin,
  requireAdmin,
} from "@/lib/adminAuth";

export async function login(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const invalid = { error: "Wrong email or password." };

  if (!email || !password) return invalid;
  // Check the allowlist first so non-staff accounts never get a session.
  if (!isAllowedAdmin(email)) return invalid;

  const { error } = await getSupabaseServerClient().auth.signInWithPassword({ email, password });
  if (error) return invalid;

  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionValue(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function setOrderStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(ORDER_STATUSES as readonly string[]).includes(status)) return;

  const { error } = await getSupabaseServerClient()
    .from("orders")
    .update({ status })
    .eq("id", id);
  if (error) console.error("[admin] status update failed", id, error);
  revalidatePath("/admin");
}

// --- Order availability (/admin/settings) ---

async function saveSettings(patch: { lead_days?: number; blackout_dates?: string[] }): Promise<boolean> {
  const { error } = await getSupabaseServerClient()
    .from("store_settings")
    .upsert({ id: 1, ...patch }, { onConflict: "id" });
  if (error) console.error("[admin] settings save failed", error);
  return !error;
}

function settingsDone(ok: boolean, message: string): never {
  revalidatePath("/admin/settings");
  const p = new URLSearchParams(ok ? { saved: message } : { error: "Could not save. Make sure db/schema.sql has been run in Supabase." });
  redirect(`/admin/settings?${p}`);
}

export async function setLeadDays(formData: FormData): Promise<void> {
  await requireAdmin();
  const days = Number(formData.get("lead_days"));
  if (!Number.isInteger(days) || days < 0 || days > MAX_LEAD_DAYS) {
    redirect(`/admin/settings?${new URLSearchParams({ error: `Enter a whole number from 0 to ${MAX_LEAD_DAYS}.` })}`);
  }
  settingsDone(await saveSettings({ lead_days: days }), "Minimum notice updated.");
}

export async function addBlackoutDates(formData: FormData): Promise<void> {
  await requireAdmin();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
    redirect(`/admin/settings?${new URLSearchParams({ error: "Choose a start date (and an end date on or after it)." })}`);
  }
  const added: string[] = [];
  for (let d = from; d <= to && added.length < 90; d = addDays(d, 1)) added.push(d);

  const current = await getStoreSettings();
  const today = storeToday();
  const next = [...new Set([...current.blackoutDates, ...added])].filter((d) => d >= today).sort();
  settingsDone(
    await saveSettings({ blackout_dates: next }),
    added.length === 1 ? "Blackout date added." : `${added.length} blackout dates added.`
  );
}

export async function removeBlackoutDate(formData: FormData): Promise<void> {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const current = await getStoreSettings();
  settingsDone(
    await saveSettings({ blackout_dates: current.blackoutDates.filter((d) => d !== date) }),
    "Blackout date removed."
  );
}

// --- Set password from a Supabase invite / password-reset email ---
// The email link lands on /admin/set-password with an access token in the URL
// hash (or a token_hash query param). We verify it, set the password with the
// service client, and sign the person in.

export async function setPasswordFromInvite(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const accessToken = String(formData.get("access_token") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "invite");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const expired = { error: "This link is invalid or has expired. Ask an admin to send a new invite." };

  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = getSupabaseServerClient();
  let user: { id: string; email?: string } | null = null;
  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error) user = data.user;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type === "recovery" ? "recovery" : "invite",
    });
    if (!error) user = data.user;
  }
  if (!user?.email) return expired;
  if (!isAllowedAdmin(user.email)) {
    return { error: "This email isn't on the staff list yet. Ask an admin to add it to ADMIN_EMAILS." };
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error("[admin] set password failed", error);
    return { error: "Could not set the password. Try a longer one, or ask for a new invite." };
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionValue(user.email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect("/admin");
}
