"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ORDER_STATUSES } from "@/lib/orderActions";
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
