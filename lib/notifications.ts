// Notifications sent to the STORE (not the customer) when a new order is placed.
// - Email via Resend
// - SMS via Twilio
//
// Per CLAUDE.md, customer SMS is disabled until consent wording is added.
// These functions only message the store owner.

import { Resend } from "resend";

interface OrderItemSummary {
  proteinName: string;
  spicyLevel: string;
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
}

export async function sendOrderEmail(
  order: OrderNotificationPayload,
  options: OrderEmailOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ORDER_FROM_EMAIL;
  // Comma-separated, e.g. "a@cupbop.com, b@cupbop.com"
  const toEmails = (process.env.STORE_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!apiKey || !fromEmail || toEmails.length === 0) {
    return {
      ok: false,
      error:
        "Resend env vars missing: set RESEND_API_KEY, ORDER_FROM_EMAIL, STORE_NOTIFICATION_EMAIL",
    };
  }

  const resend = new Resend(apiKey);
  const { html, text, subject } = renderOrderEmail(order, options);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      replyTo: order.customer_email,
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
  { confirmUrl, reminder }: OrderEmailOptions
): {
  subject: string;
  html: string;
  text: string;
} {
  const when = `${order.pickup_date} at ${order.pickup_time.slice(0, 5)}`;
  const subject = reminder
    ? `Reminder #${reminder.count}: unconfirmed ${order.order_type} order — ${order.customer_name} — ${when}`
    : `New ${order.order_type} order — ${order.customer_name} — $${order.subtotal.toFixed(2)}`;
  const heading = reminder
    ? `Unconfirmed ${order.order_type} Order`
    : `New ${order.order_type} Order`;
  const reminderNote = reminder
    ? `This order is still not confirmed and is due in about ${reminder.hoursUntil} hours.`
    : "";

  const itemsTextLines = order.items.map(
    (it) =>
      `  ${it.qty}× ${it.proteinName} Cupbop · ${it.spicyLevel}` +
      (it.mods && it.mods.length ? ` · Mods: ${it.mods.join(", ")}` : "") +
      `  ($${it.lineTotal.toFixed(2)})`
  );

  const text = [
    reminder ? `UNCONFIRMED ORDER — Cupbop Park City` : `NEW ORDER — Cupbop Park City`,
    reminderNote,
    confirmUrl ? `Confirm this order: ${confirmUrl}` : ``,
    ``,
    `Order ID: ${order.orderId}`,
    `Type:     ${order.order_type}`,
    `Customer: ${order.customer_name}`,
    `Phone:    ${order.customer_phone}`,
    `Email:    ${order.customer_email}`,
    `When:     ${when}`,
    order.delivery_address ? `Delivery: ${order.delivery_address}` : ``,
    `Payment:  ${order.payment_method} (at store)`,
    ``,
    `ITEMS:`,
    ...itemsTextLines,
    ``,
    `Subtotal: $${order.subtotal.toFixed(2)}`,
    order.special_instructions ? `\nNotes: ${order.special_instructions}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const itemsHtmlRows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <strong>${it.qty}×</strong> ${escapeHtml(it.proteinName)} Cupbop
            <div style="color:#555;font-size:13px">${escapeHtml(it.spicyLevel)}${
              it.mods && it.mods.length
                ? ` &middot; ${escapeHtml(it.mods.join(", "))}`
                : ""
            }</div>
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
      ${reminderNote ? `<p style="margin:0 0 16px;background:#ffe4e4;border:1px solid #d33;padding:10px 12px;border-radius:8px;font-size:14px;font-weight:bold">${reminderNote}</p>` : ""}
      ${confirmUrl ? `<p style="margin:0 0 20px;text-align:center"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#111;color:#FFD200;padding:12px 24px;border-radius:999px;font-weight:800;text-decoration:none">Confirm order</a><br><a href="${escapeHtml(new URL("/admin", confirmUrl).toString())}" style="display:inline-block;margin-top:10px;color:#555;font-size:13px">View all orders</a></p>` : ""}
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#555">Order ID</td><td style="padding:4px 0;text-align:right;font-family:monospace">${escapeHtml(order.orderId)}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Customer</td><td style="padding:4px 0;text-align:right;font-weight:bold">${escapeHtml(order.customer_name)}</td></tr>
        <tr><td style="padding:4px 0;color:#555">Phone</td><td style="padding:4px 0;text-align:right"><a href="tel:${escapeHtml(order.customer_phone)}">${escapeHtml(order.customer_phone)}</a></td></tr>
        <tr><td style="padding:4px 0;color:#555">Email</td><td style="padding:4px 0;text-align:right"><a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a></td></tr>
        <tr><td style="padding:4px 0;color:#555">${order.order_type === "Catering" ? "Delivery" : "Pickup"}</td><td style="padding:4px 0;text-align:right;font-weight:bold">${escapeHtml(when)}</td></tr>
        ${order.delivery_address ? `<tr><td style="padding:4px 0;color:#555">Address</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.delivery_address)}</td></tr>` : ""}
        <tr><td style="padding:4px 0;color:#555">Payment</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.payment_method)} (at store)</td></tr>
      </table>

      <h3 style="margin:20px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.1em">Items</h3>
      <table style="width:100%;border-collapse:collapse;border-top:2px solid #111">${itemsHtmlRows}</table>
      <div style="margin-top:12px;padding-top:12px;border-top:2px solid #111;display:flex;justify-content:space-between;font-size:16px;font-weight:800">
        <span>Subtotal</span><span>$${order.subtotal.toFixed(2)}</span>
      </div>

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
    .map((it) => `${it.qty}x ${it.proteinName}`)
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
