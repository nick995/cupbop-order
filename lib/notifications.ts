// Notifications sent to the STORE (not the customer) when a new order is placed.
// - Email via Resend
// - SMS via Twilio
//
// Per CLAUDE.md, customer SMS is disabled until consent wording is added.
// These functions only message the store owner.

import { Resend } from "resend";
import { itemDisplayName } from "@/lib/menu";

interface OrderItemSummary {
  name?: string;
  proteinName?: string; // orders saved before `name` existed
  spicyLevel?: string;
  mods?: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderNotificationPayload {
  orderId: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: "Pickup" | "Catering";
  pickup_date: string;
  pickup_time: string;
  delivery_address?: string | null;
  payment_method: "Cash" | "Credit Card";
  special_instructions?: string;
  subtotal: number;
  items: OrderItemSummary[];
}

// ---------- EMAIL (Resend) ----------

export interface OrderEmailOptions {
  // Link to the confirm page; omitted when the order wasn't stored.
  confirmUrl?: string;
  // Set for reminder emails about orders still in "New" status.
  reminder?: { count: number; hoursUntil: number };
  // Set for orders staff entered in /admin/orders/new.
  manual?: { enteredBy: string; discount: number };
}

// Store inbox(es) plus every admin, so staff see each order. Both env vars are comma-separated.
function orderEmailRecipients(): string[] {
  const all = [process.env.STORE_NOTIFICATION_EMAIL, process.env.ADMIN_EMAILS]
    .flatMap((v) => (v ?? "").split(","))
    .map((e) => e.trim())
    .filter(Boolean);
  return [...new Map(all.map((e) => [e.toLowerCase(), e])).values()];
}

export async function sendOrderEmail(
  order: OrderNotificationPayload,
  options: OrderEmailOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ORDER_FROM_EMAIL;
  const toEmails = orderEmailRecipients();

  if (!apiKey || !fromEmail || toEmails.length === 0) {
    return {
      ok: false,
      error:
        "Resend env vars missing: set RESEND_API_KEY, ORDER_FROM_EMAIL, and STORE_NOTIFICATION_EMAIL or ADMIN_EMAILS",
    };
  }

  const resend = new Resend(apiKey);
  const { html, text, subject } = renderOrderEmail(order, options);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      ...(order.customer_email && { replyTo: order.customer_email }),
      subject,
      html,
      text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: !!data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

function renderOrderEmail(
  order: OrderNotificationPayload,
  { confirmUrl, reminder, manual }: OrderEmailOptions
): {
  subject: string;
  html: string;
  text: string;
} {
  const when = `${order.pickup_date} at ${order.pickup_time.slice(0, 5)}`;
  const discount = manual?.discount ?? 0;
  const total = order.subtotal - discount;
  const subject = reminder
    ? `Reminder #${reminder.count}: unconfirmed ${order.order_type} order — ${order.customer_name} — ${when}`
    : manual
      ? `Staff ${order.order_type} order — ${order.customer_name} — $${total.toFixed(2)} — ${when}`
      : `New ${order.order_type} order — ${order.customer_name} — $${order.subtotal.toFixed(2)}`;
  const heading = reminder
    ? `Unconfirmed ${order.order_type} Order`
    : manual
      ? `Staff-entered ${order.order_type} Order`
      : `New ${order.order_type} Order`;
  const reminderNote = reminder
    ? `This order is still not confirmed and is due in about ${reminder.hoursUntil} hours.`
    : manual
      ? `Entered by ${manual.enteredBy}.`
      : "";
  const priceLines = discount
    ? [
        `Menu price: $${order.subtotal.toFixed(2)}`,
        `${discount > 0 ? "Discount" : "Added"}: $${Math.abs(discount).toFixed(2)}`,
        `Total:      $${total.toFixed(2)}`,
      ]
    : [`Subtotal: $${order.subtotal.toFixed(2)}`];

  const itemsTextLines = order.items.map(
    (it) =>
      `  ${it.qty}× ${itemDisplayName(it)}` +
      (it.spicyLevel ? ` · ${it.spicyLevel}` : "") +
      (it.mods && it.mods.length ? ` · Mods: ${it.mods.join(", ")}` : "") +
      `  ($${it.lineTotal.toFixed(2)})`
  );

  const text = [
    reminder
      ? `UNCONFIRMED ORDER — Cupbop Park City`
      : manual
        ? `STAFF-ENTERED ORDER — Cupbop Park City`
        : `NEW ORDER — Cupbop Park City`,
    reminderNote,
    confirmUrl ? `Confirm this order: ${confirmUrl}` : ``,
    ``,
    `Order ID: ${order.orderId}`,
    `Type:     ${order.order_type}`,
    `Customer: ${order.customer_name}`,
    order.customer_phone ? `Phone:    ${order.customer_phone}` : ``,
    order.customer_email ? `Email:    ${order.customer_email}` : ``,
    `When:     ${when}`,
    order.delivery_address ? `Delivery: ${order.delivery_address}` : ``,
    `Payment:  ${order.payment_method} (at store)`,
    ``,
    `ITEMS:`,
    ...itemsTextLines,
    ``,
    ...priceLines,
    order.special_instructions ? `\nNotes: ${order.special_instructions}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const itemsHtmlRows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <strong>${it.qty}×</strong> ${escapeHtml(itemDisplayName(it))}
            <div style="color:#555;font-size:13px">${escapeHtml(
              [it.spicyLevel, ...(it.mods ?? [])].filter(Boolean).join(" · ")
            )}</div>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-weight:bold">
            $${it.lineTotal.toFixed(2)}
          </td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fffdf5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #111;border-radius:16px;overflow:hidden;box-shadow:0 4px 0 #111">
    <div style="background:#FFD200;padding:16px 20px;border-bottom:2px solid #111">
      <div style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">Cupbop Park City</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">${heading}</div>
    </div>
    <div style="padding:20px">
      ${reminderNote ? `<p style="margin:0 0 16px;background:${manual ? "#fff8d8;border:1px solid #FFD200" : "#ffe4e4;border:1px solid #d33"};padding:10px 12px;border-radius:8px;font-size:14px;font-weight:bold">${reminderNote}</p>` : ""}
      ${confirmUrl ? `<p style="margin:0 0 20px;text-align:center"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#111;color:#FFD200;padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">Confirm order</a><br><a href="${escapeHtml(new URL("/admin", confirmUrl).toString())}" style="display:inline-block;margin-top:10px;color:#555;font-size:13px">View all orders</a></p>` : ""}
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#555">Order ID</td><td style="padding:4px 0;text-align:right;font-family:monospace">${escapeHtml(order.orderId)}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Customer</td><td style="padding:4px 0;text-align:right;font-weight:bold">${escapeHtml(order.customer_name)}</td></tr>
        ${order.customer_phone ? `<tr><td style="padding:4px 0;color:#555">Phone</td><td style="padding:4px 0;text-align:right"><a href="tel:${escapeHtml(order.customer_phone)}">${escapeHtml(order.customer_phone)}</a></td></tr>` : ""}
        ${order.customer_email ? `<tr><td style="padding:4px 0;color:#555">Email</td><td style="padding:4px 0;text-align:right"><a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a></td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#555">${order.order_type === "Catering" ? "Delivery" : "Pickup"}</td><td style="padding:4px 0;text-align:right;font-weight:bold">${escapeHtml(when)}</td></tr>
        ${order.delivery_address ? `<tr><td style="padding:4px 0;color:#555">Address</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.delivery_address)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#555">Payment</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.payment_method)} (at store)</td></tr>
      </table>

      <h3 style="margin:20px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.1em">Items</h3>
      <table style="width:100%;border-collapse:collapse;border-top:2px solid #111">${itemsHtmlRows}</table>
      ${
        discount
          ? `<table style="width:100%;margin-top:12px;border-top:2px solid #111;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0 2px;color:#555">Menu price</td><td style="padding:6px 0 2px;text-align:right">$${order.subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:2px 0;color:#555">${discount > 0 ? "Discount" : "Added"}</td><td style="padding:2px 0;text-align:right">${discount > 0 ? "−" : "+"}$${Math.abs(discount).toFixed(2)}</td></tr>
        <tr><td style="padding:4px 0;font-size:16px;font-weight:800">Total</td><td style="padding:4px 0;text-align:right;font-size:16px;font-weight:800">$${total.toFixed(2)}</td></tr>
      </table>`
          : `<div style="margin-top:12px;padding-top:12px;border-top:2px solid #111;display:flex;justify-content:space-between;font-size:16px;font-weight:800">
        <span>Subtotal</span><span>$${order.subtotal.toFixed(2)}</span>
      </div>`
      }

      ${order.special_instructions ? `<div style="margin-top:16px;background:#fff8d8;border:1px solid #FFD200;padding:10px 12px;border-radius:8px;font-size:13px"><strong>Notes:</strong> ${escapeHtml(order.special_instructions)}</div>` : ""}
    </div>
  </div>
</body></html>`;

  return { subject, html, text };
}

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- SMS (Twilio) ----------

export async function sendOrderSMS(
  order: OrderNotificationPayload
): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_PHONE;
  const toPhone = process.env.STORE_NOTIFICATION_PHONE;

  if (!accountSid || !authToken || !fromPhone || !toPhone) {
    return {
      ok: false,
      error:
        "Twilio env vars missing: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE, STORE_NOTIFICATION_PHONE",
    };
  }

  // Lazy import so the package isn't loaded unless SMS is configured
  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);

  const summary = order.items
    .map((it) => `${it.qty}x ${itemDisplayName(it)}`)
    .join(", ");

  const body =
    `New ${order.order_type} order $${order.subtotal.toFixed(2)}\n` +
    `${order.customer_name} (${order.customer_phone})\n` +
    `${order.pickup_date} ${order.pickup_time}\n` +
    `${summary}` +
    (order.delivery_address ? `\nDeliver: ${order.delivery_address}` : "");

  try {
    const msg = await client.messages.create({
      body: body.slice(0, 1600), // SMS practical max
      from: fromPhone,
      to: toPhone,
    });
    return { ok: !!msg.sid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown SMS error",
    };
  }
}
