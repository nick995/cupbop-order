import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { OrderNotificationPayload, sendOrderEmail } from "@/lib/notifications";
import { confirmUrlFor, orderInstant, reminderDue } from "@/lib/orderActions";

// Called hourly by .github/workflows/order-reminders.yml.
// Re-emails the store about orders still in "New" status (see lib/orderActions.ts
// for the cadence). Also keeps the free Supabase project from auto-pausing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  // Yesterday (UTC) is a safe lower bound for any order still in the future.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "New")
    .gte("pickup_date", since);

  if (error) {
    console.error("[reminders] query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const now = new Date();
  const origin = new URL(request.url).origin;
  const sent: string[] = [];
  const failed: string[] = [];

  for (const row of orders ?? []) {
    const orderAt = orderInstant(row.pickup_date, row.pickup_time);
    const last = row.last_notified_at ? new Date(row.last_notified_at) : null;
    const { due, hoursUntil } = reminderDue(orderAt, last, now);
    if (!due) continue;

    const count = (row.reminder_count ?? 0) + 1;
    const result = await sendOrderEmail(rowToPayload(row), {
      confirmUrl: confirmUrlFor(row.id, origin),
      reminder: { count, hoursUntil },
    });

    if (!result.ok) {
      console.warn("[reminders] email failed", row.id, result.error);
      failed.push(row.id);
      continue;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ last_notified_at: now.toISOString(), reminder_count: count })
      .eq("id", row.id)
      .eq("status", "New");
    if (updateError) console.error("[reminders] update failed", row.id, updateError);
    sent.push(row.id);
  }

  return NextResponse.json({ checked: orders?.length ?? 0, sent: sent.length, failed: failed.length });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPayload(row: any): OrderNotificationPayload {
  return {
    orderId: row.id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    order_type: row.order_type,
    pickup_date: row.pickup_date,
    pickup_time: row.pickup_time,
    delivery_address: row.delivery_address,
    payment_method: row.payment_method,
    special_instructions: row.special_instructions ?? undefined,
    subtotal: Number(row.subtotal),
    items: (row.items ?? []).map((it: OrderNotificationPayload["items"][number]) => ({
      proteinName: it.proteinName,
      spicyLevel: it.spicyLevel,
      mods: it.mods,
      qty: it.qty,
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
    })),
  };
}
