import { after, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { confirmUrlFor } from "@/lib/orderActions";
import {
  CATERING_MIN_SERVINGS,
  LineSpec,
  OrderItem,
  buildOrderItem,
  cateringServings,
} from "@/lib/menu";
import { dateUnavailableReason, getStoreSettings } from "@/lib/storeSettings";
import {
  OrderEmailOptions,
  OrderNotificationPayload,
  sendOrderEmail,
  sendOrderSMS,
} from "@/lib/notifications";

interface OrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: "Pickup" | "Catering";
  pickup_date: string;
  pickup_time: string;
  delivery_address?: string;
  payment_method: "Cash" | "Credit Card";
  special_instructions: string;
  lines: LineSpec[];
}

// A priced order, built on the server from menu data.
type PricedOrder = Omit<OrderPayload, "lines"> & { items: OrderItem[]; subtotal: number };

function validate(body: unknown): body is OrderPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.customer_name === "string" &&
    typeof b.customer_phone === "string" &&
    typeof b.customer_email === "string" &&
    (b.order_type === "Pickup" || b.order_type === "Catering") &&
    typeof b.pickup_date === "string" &&
    typeof b.pickup_time === "string" &&
    (b.payment_method === "Cash" || b.payment_method === "Credit Card") &&
    Array.isArray(b.lines) &&
    b.lines.length > 0 &&
    b.lines.length <= 100
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!validate(payload)) {
    return NextResponse.json(
      { error: "Missing or invalid fields." },
      { status: 400 }
    );
  }

  // Price every line from the menu; never trust client prices or names.
  const items = payload.lines.map((l) =>
    l && typeof l === "object" ? buildOrderItem(l as LineSpec) : null
  );
  if (items.some((it) => it === null)) {
    return NextResponse.json(
      { error: "Your cart has an item we couldn't find. Please refresh the menu and try again." },
      { status: 400 }
    );
  }
  const order: PricedOrder = {
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    customer_email: payload.customer_email,
    order_type: payload.order_type,
    pickup_date: payload.pickup_date,
    pickup_time: payload.pickup_time,
    delivery_address: payload.delivery_address,
    payment_method: payload.payment_method,
    special_instructions: payload.special_instructions,
    items: items as OrderItem[],
    subtotal: Math.round(items.reduce((sum, it) => sum + it!.lineTotal, 0) * 100) / 100,
  };

  if (order.order_type === "Pickup" && order.items.some((it) => it.kind === "buffet")) {
    return NextResponse.json({ error: "Buffet trays are for catering orders only." }, { status: 400 });
  }

  // Server-side enforcement of catering rules
  if (order.order_type === "Catering") {
    const servings = cateringServings(order.items);
    if (servings < CATERING_MIN_SERVINGS) {
      return NextResponse.json(
        {
          error: `Catering orders require at least ${CATERING_MIN_SERVINGS} bowls or buffet servings.`,
        },
        { status: 400 }
      );
    }
    if (!order.delivery_address || !order.delivery_address.trim()) {
      return NextResponse.json(
        { error: "Catering orders require a delivery address." },
        { status: 400 }
      );
    }
  }

  // Minimum notice + blackout dates set by staff in /admin/settings.
  const dateProblem = dateUnavailableReason(order.pickup_date, await getStoreSettings());
  if (dateProblem) {
    return NextResponse.json({ error: dateProblem }, { status: 400 });
  }

  // Try to insert into Supabase. If env vars are missing (local dev without
  // Supabase yet), we still let the order through with a generated ID so the
  // UI flow can be tested end-to-end. Remove this fallback once Supabase is set up.
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabase) {
    // In production a missing DB config must not look like a successful order.
    if (process.env.NODE_ENV === "production") {
      console.error("[orders] Supabase env vars missing in production — rejecting order.");
      return NextResponse.json(
        { error: "Ordering is temporarily unavailable. Please call the store." },
        { status: 503 }
      );
    }
    console.warn(
      "[orders] Supabase env vars missing — skipping DB insert. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistence."
    );
    const localId = `local-${Date.now()}`;
    // Still try to send notifications even without DB so the store can be alerted.
    after(() => notifyStore({ ...order, orderId: localId }));
    return NextResponse.json({ id: localId, stored: false });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: order.customer_name.trim(),
        customer_phone: order.customer_phone.trim(),
        customer_email: order.customer_email.trim().toLowerCase(),
        order_type: order.order_type,
        pickup_date: order.pickup_date,
        pickup_time: order.pickup_time,
        delivery_address: order.delivery_address?.trim() || null,
        payment_method: order.payment_method,
        special_instructions: order.special_instructions?.trim() || null,
        status: "New",
        subtotal: order.subtotal,
        items: order.items,
        // The new-order email goes out right after this insert; reminders
        // count from here.
        last_notified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[orders] supabase insert error", error);
      return NextResponse.json(
        { error: "Could not save your order. Please try again." },
        { status: 500 }
      );
    }

    // Notify the store (email + SMS) after the response is sent. `after()`
    // keeps the serverless function alive until it finishes; a bare
    // fire-and-forget promise can be cut off on Vercel.
    const confirmUrl = confirmUrlFor(data.id, new URL(request.url).origin);
    after(() => notifyStore({ ...order, orderId: data.id }, { confirmUrl }));

    return NextResponse.json({ id: data.id, stored: true });
  } catch (err) {
    console.error("[orders] unexpected", err);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

async function notifyStore(
  payload: PricedOrder & { orderId: string },
  emailOptions: OrderEmailOptions = {}
): Promise<void> {
  const notif: OrderNotificationPayload = {
    orderId: payload.orderId,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    customer_email: payload.customer_email,
    order_type: payload.order_type,
    pickup_date: payload.pickup_date,
    pickup_time: payload.pickup_time,
    delivery_address: payload.delivery_address ?? null,
    payment_method: payload.payment_method,
    special_instructions: payload.special_instructions,
    subtotal: payload.subtotal,
    items: payload.items,
  };

  const [emailResult, smsResult] = await Promise.all([
    sendOrderEmail(notif, emailOptions).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : "Email crashed",
    })),
    sendOrderSMS(notif).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : "SMS crashed",
    })),
  ]);

  if (!emailResult.ok) {
    console.warn("[orders] email notify failed:", emailResult.error);
  }
  if (!smsResult.ok) {
    console.warn("[orders] sms notify failed:", smsResult.error);
  }
}
