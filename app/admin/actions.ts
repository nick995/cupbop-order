"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase";
import { ORDER_STATUSES, storeToday } from "@/lib/orderActions";
import { ActivityKind, TARGET_STATUSES } from "@/lib/targets";
import {
  LineSpec,
  MAX_LINE_QTY,
  OrderItem,
  buildOrderItem,
  discountAmount,
  parseDiscountType,
} from "@/lib/menu";
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

// --- Catering targets (/admin/targets) ---

function cleanText(value: FormDataEntryValue | null, max = 500): string | null {
  const s = String(value ?? "").trim().slice(0, max);
  return s || null;
}

function cleanCoord(value: FormDataEntryValue | null, limit: number): number | null {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

function targetsDone(message: string, ok = true): never {
  revalidatePath("/admin/targets");
  const p = new URLSearchParams(
    ok ? { saved: message } : { error: "Could not save. Make sure db/schema.sql has been run in Supabase." }
  );
  redirect(`/admin/targets?${p}`);
}

// Activity history is best-effort: a failed log never blocks the main change.
async function logTargetActivity(
  targetId: string,
  entry: { kind: ActivityKind; status?: string; note?: string | null },
  adminEmail: string
): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from("target_activities")
    .insert({ target_id: targetId, ...entry, created_by: adminEmail });
  if (error) console.error("[admin] activity log failed", targetId, error);
}

export async function addTarget(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = cleanText(formData.get("name"), 200);
  if (!name) redirect(`/admin/targets?${new URLSearchParams({ error: "Enter a name or pick a place from search." })}`);

  const website = cleanText(formData.get("website"), 300);
  const { data, error } = await getSupabaseServerClient()
    .from("catering_targets")
    .insert({
      name,
      address: cleanText(formData.get("address"), 300),
      phone: cleanText(formData.get("phone"), 50),
      website: website && /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : null,
      place_id: cleanText(formData.get("place_id"), 300),
      lat: cleanCoord(formData.get("lat"), 90),
      lng: cleanCoord(formData.get("lng"), 180),
      notes: cleanText(formData.get("notes"), 2000),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[admin] add target failed", error);
    targetsDone("", false);
  }
  // Straight to the new place so the first visit can be logged.
  targetPage(data.id, { saved: `Added ${name}.` });
}

function targetPage(id: string, params: Record<string, string>): never {
  revalidatePath("/admin/targets");
  revalidatePath(`/admin/targets/${id}`);
  redirect(`/admin/targets/${id}?${new URLSearchParams(params)}`);
}

const SCHEMA_ERROR = "Could not save. Make sure db/schema.sql has been run in Supabase.";

// One form for "what happened": visit / call / email / note, notes, outcome
// (optional status change) and the next follow-up.
export async function logActivity(formData: FormData): Promise<void> {
  const adminEmail = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "visit");
  if (!id || !["visit", "call", "email", "note"].includes(kind)) return;
  const note = cleanText(formData.get("note"), 2000);
  const outcome = String(formData.get("outcome") ?? "");
  const newStatus = (TARGET_STATUSES as readonly string[]).includes(outcome) ? outcome : null;
  if (kind === "note" && !note && !newStatus) targetPage(id, { error: "Write a note first." });

  const supabase = getSupabaseServerClient();
  const { data: target } = await supabase.from("catering_targets").select("status").eq("id", id).single();
  if (!target) targetPage(id, { error: "That place no longer exists." });

  // A first visit with no explicit outcome moves the place out of "To visit".
  const status = newStatus ?? (kind === "visit" && target.status === "To visit" ? "Visited" : null);

  const patch: Record<string, string | null> = {};
  if (kind === "visit") patch.last_visited_at = new Date().toISOString();
  if (status) patch.status = status;
  const followIn = String(formData.get("follow_up_in") ?? "");
  const followDate = String(formData.get("follow_up_date") ?? "");
  if (isIsoDate(followDate)) patch.next_follow_up = followDate;
  else if (followIn === "none") patch.next_follow_up = null;
  else if (/^\d+$/.test(followIn)) patch.next_follow_up = addDays(storeToday(), Number(followIn));
  // Closed out (won or lost): drop the follow-up unless a specific date was picked.
  if ((status === "Not interested" || status === "Customer") && !isIsoDate(followDate)) {
    patch.next_follow_up = null;
  }

  // Update the place first so a failure doesn't leave a history entry that didn't happen.
  if (Object.keys(patch).length) {
    const { error: patchError } = await supabase.from("catering_targets").update(patch).eq("id", id);
    if (patchError) {
      console.error("[admin] target update for log failed", id, patchError);
      targetPage(id, { error: SCHEMA_ERROR });
    }
  }
  const { error } = await supabase.from("target_activities").insert({
    target_id: id,
    kind,
    note,
    status: status && status !== target.status ? status : null,
    created_by: adminEmail,
  });
  if (error) {
    console.error("[admin] log activity failed", id, error);
    targetPage(id, { error: SCHEMA_ERROR });
  }
  const label = { visit: "Visit", call: "Call", email: "Email", note: "Note" }[kind];
  targetPage(id, { saved: `${label} saved.` });
}

export async function updateTargetDetails(formData: FormData): Promise<void> {
  const adminEmail = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = cleanText(formData.get("name"), 200);
  if (!id) return;
  if (!name) targetPage(id, { error: "Name can't be empty." });
  const status = String(formData.get("status") ?? "");
  const followUp = String(formData.get("next_follow_up") ?? "");
  const website = cleanText(formData.get("website"), 300);

  const supabase = getSupabaseServerClient();
  const { data: before } = await supabase.from("catering_targets").select("status").eq("id", id).single();
  const { error } = await supabase
    .from("catering_targets")
    .update({
      name,
      contact_name: cleanText(formData.get("contact_name"), 200),
      phone: cleanText(formData.get("phone"), 50),
      address: cleanText(formData.get("address"), 300),
      website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
      next_follow_up: isIsoDate(followUp) ? followUp : null,
      notes: cleanText(formData.get("notes"), 2000),
      ...((TARGET_STATUSES as readonly string[]).includes(status) && { status }),
    })
    .eq("id", id);
  if (error) {
    console.error("[admin] update target details failed", id, error);
    targetPage(id, { error: SCHEMA_ERROR });
  }
  if (before && status && status !== before.status && (TARGET_STATUSES as readonly string[]).includes(status)) {
    await logTargetActivity(id, { kind: "status", status }, adminEmail);
  }
  targetPage(id, { saved: "Details saved." });
}

// Attribute an order to a sales target. Linking also marks the target a Customer.
export async function setOrderTarget(formData: FormData): Promise<void> {
  const adminEmail = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const targetId = String(formData.get("target_id") ?? "") || null;
  if (!id) return;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("orders").update({ target_id: targetId }).eq("id", id);
  if (error) console.error("[admin] link order to target failed", id, error);
  if (!error && targetId) {
    const { error: statusError } = await supabase
      .from("catering_targets")
      .update({ status: "Customer" })
      .eq("id", targetId)
      .neq("status", "Customer");
    if (statusError) console.error("[admin] mark target customer failed", targetId, statusError);
    await logTargetActivity(targetId, { kind: "order", note: "Order linked from the Orders page" }, adminEmail);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/targets");
}

export async function deleteTarget(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await getSupabaseServerClient().from("catering_targets").delete().eq("id", id);
  if (error) console.error("[admin] delete target failed", id, error);
  targetsDone(error ? "" : "Place removed.", !error);
}

// Removes one history entry. Deleting a visit re-derives "last visited" from
// the visits that remain; status and follow-up are left as they are.
export async function deleteActivity(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const targetId = String(formData.get("target_id") ?? "");
  if (!id || !targetId || formData.get("confirm") !== "yes") return;
  const supabase = getSupabaseServerClient();
  const { data: removed, error } = await supabase
    .from("target_activities")
    .delete()
    .eq("id", id)
    .eq("target_id", targetId)
    .select("kind")
    .maybeSingle();
  if (error) {
    console.error("[admin] delete activity failed", id, error);
    targetPage(targetId, { error: "Could not delete that entry." });
  }
  if (removed?.kind === "visit") {
    const { data: lastVisit } = await supabase
      .from("target_activities")
      .select("created_at")
      .eq("target_id", targetId)
      .eq("kind", "visit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase
      .from("catering_targets")
      .update({ last_visited_at: lastVisit?.created_at ?? null })
      .eq("id", targetId);
  }
  targetPage(targetId, { saved: "Entry deleted." });
}

// --- Manual orders + discounts (/admin/orders/new) ---

interface ManualLine {
  kind: "bowl" | "buffet" | "extra" | "custom";
  itemId?: string;
  spicyLevelId?: string;
  name?: string;   // custom only
  price?: number;  // custom only
  qty: number;
}

export async function createManualOrder(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const adminEmail = await requireAdmin();

  const name = cleanText(formData.get("customer_name"), 200);
  const orderType = String(formData.get("order_type") ?? "");
  const date = String(formData.get("pickup_date") ?? "");
  const time = String(formData.get("pickup_time") ?? "");
  const payment = String(formData.get("payment_method") ?? "");
  const status = String(formData.get("status") ?? "Confirmed");
  if (!name) return { error: "Enter the customer name." };
  if (orderType !== "Pickup" && orderType !== "Catering") return { error: "Choose an order type." };
  if (!isIsoDate(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Choose a date and time." };
  if (payment !== "Cash" && payment !== "Credit Card") return { error: "Choose a payment method." };
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return { error: "Choose a status." };

  let lines: ManualLine[];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(lines)) throw new Error();
  } catch {
    return { error: "Couldn't read the items. Refresh and try again." };
  }
  if (lines.length === 0) return { error: "Add at least one item." };
  if (lines.length > 100) return { error: "Too many items." };

  const items: OrderItem[] = [];
  for (const l of lines) {
    const qty = Math.floor(Number(l?.qty));
    if (l?.kind === "custom") {
      const itemName = String(l.name ?? "").trim().slice(0, 200);
      const price = Math.round(Number(l.price) * 100) / 100;
      if (!itemName) return { error: "Give every custom item a name." };
      if (!Number.isFinite(price) || price < 0 || price > 100_000) return { error: `Check the price for "${itemName}".` };
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_LINE_QTY) return { error: `Check the quantity for "${itemName}".` };
      items.push({ kind: "custom", itemId: "custom", name: itemName, qty, unitPrice: price, lineTotal: Math.round(price * qty * 100) / 100 });
      continue;
    }
    const built = buildOrderItem({ kind: l?.kind, itemId: String(l?.itemId ?? ""), spicyLevelId: l?.spicyLevelId, modIds: [], qty } as LineSpec);
    if (!built) return { error: "One of the items is invalid. Check items and quantities." };
    items.push(built);
  }

  const subtotal = Math.round(items.reduce((sum, it) => sum + it.lineTotal, 0) * 100) / 100;
  const discount = discountAmount(
    subtotal,
    parseDiscountType(formData.get("discount_type")),
    String(formData.get("discount_value") ?? "")
  );
  const targetId = String(formData.get("target_id") ?? "") || null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_name: name,
      customer_phone: cleanText(formData.get("customer_phone"), 50) ?? "",
      customer_email: (cleanText(formData.get("customer_email"), 200) ?? "").toLowerCase(),
      order_type: orderType,
      pickup_date: date,
      pickup_time: time,
      delivery_address: cleanText(formData.get("delivery_address"), 500),
      payment_method: payment,
      special_instructions: cleanText(formData.get("special_instructions"), 2000),
      status,
      subtotal,
      discount,
      items,
      source: "admin",
      created_by: adminEmail,
      target_id: targetId,
      // No store email for staff-entered orders; reminders only apply to "New".
      last_notified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[admin] manual order failed", error);
    return { error: "Could not save the order. Make sure db/schema.sql has been run in Supabase." };
  }
  if (targetId) {
    await supabase.from("catering_targets").update({ status: "Customer" }).eq("id", targetId).neq("status", "Customer");
    await logTargetActivity(
      targetId,
      { kind: "order", note: `Order entered: $${(subtotal - discount).toFixed(2)} for ${date}` },
      adminEmail
    );
  }
  revalidatePath("/admin");
  revalidatePath("/admin/targets");
  redirect(`/admin?view=all#order-${data.id}`);
}

export async function setOrderDiscount(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = getSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("subtotal").eq("id", id).single();
  if (!order) return;
  const discount = discountAmount(
    Number(order.subtotal),
    parseDiscountType(formData.get("discount_type")),
    String(formData.get("discount_value") ?? "")
  );
  const { error } = await supabase.from("orders").update({ discount }).eq("id", id);
  if (error) console.error("[admin] discount update failed", id, error);
  revalidatePath("/admin");
  revalidatePath("/admin/targets");
}

export async function deleteOrder(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || formData.get("confirm") !== "yes") return;
  const { error } = await getSupabaseServerClient().from("orders").delete().eq("id", id);
  if (error) console.error("[admin] delete order failed", id, error);
  revalidatePath("/admin");
  revalidatePath("/admin/targets");
}
