"use client";

// Staff-entered order: any menu item or a custom item at any price, plus a
// $ or % discount. The server re-prices menu items; this only previews totals.

import { useActionState, useState } from "react";
import {
  BUFFET_PROTEINS,
  DEFAULT_SPICY_ID,
  EXTRAS,
  PROTEINS,
  SPICY_LEVELS,
  buildOrderItem,
  DiscountType,
  discountAmount,
  priceDifferenceLabel,
} from "@/lib/menu";
import { ORDER_STATUSES } from "@/lib/orderActions";
import { createManualOrder } from "../../actions";

type Kind = "bowl" | "buffet" | "extra" | "custom";

interface Row {
  key: number;
  kind: Kind;
  itemId: string;
  spicyLevelId: string;
  name: string;
  price: string;
  qty: string;
}

interface TargetOption {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

const inputCls = "w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm";

let nextKey = 1;
const newRow = (): Row => ({
  key: nextKey++,
  kind: "bowl",
  itemId: PROTEINS[0].id,
  spicyLevelId: DEFAULT_SPICY_ID,
  name: "",
  price: "",
  qty: "1",
});

function rowTotal(r: Row): number {
  const qty = Math.floor(Number(r.qty)) || 0;
  if (r.kind === "custom") return Math.round((Number(r.price) || 0) * qty * 100) / 100;
  return buildOrderItem({ kind: r.kind, itemId: r.itemId, spicyLevelId: r.spicyLevelId, qty })?.lineTotal ?? 0;
}

export default function NewOrderForm({
  today,
  targets,
  initialTargetId,
}: {
  today: string;
  targets: TargetOption[];
  initialTargetId: string;
}) {
  const [state, formAction, pending] = useActionState(createManualOrder, {});
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [orderType, setOrderType] = useState<"Pickup" | "Catering">("Catering");
  const [discountType, setDiscountType] = useState<DiscountType>("total");
  const [discountValue, setDiscountValue] = useState("");
  const [targetId, setTargetId] = useState(initialTargetId);
  const target = targets.find((t) => t.id === targetId);

  const subtotal = Math.round(rows.reduce((sum, r) => sum + rowTotal(r), 0) * 100) / 100;
  const discount = discountAmount(subtotal, discountType, discountValue);
  const total = subtotal - discount;

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const linesJson = JSON.stringify(
    rows.map((r) =>
      r.kind === "custom"
        ? { kind: "custom", name: r.name, price: Number(r.price), qty: Number(r.qty) }
        : { kind: r.kind, itemId: r.itemId, ...(r.kind === "bowl" && { spicyLevelId: r.spicyLevelId }), qty: Number(r.qty) }
    )
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="lines" value={linesJson} />

      <Section title="Customer">
        {targets.length > 0 && (
          <Label text="Sales target (optional)" className="sm:col-span-2">
            <select name="target_id" value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Label>
        )}
        <Label text="Customer name *">
          <input key={`name-${targetId}`} name="customer_name" required defaultValue={target?.name ?? ""} className={inputCls} />
        </Label>
        <Label text="Phone">
          <input key={`phone-${targetId}`} name="customer_phone" type="tel" defaultValue={target?.phone ?? ""} className={inputCls} />
        </Label>
        <Label text="Email" className="sm:col-span-2">
          <input name="customer_email" type="email" className={inputCls} />
        </Label>
      </Section>

      <Section title="When & where">
        <Label text="Order type">
          <select name="order_type" value={orderType} onChange={(e) => setOrderType(e.target.value as "Pickup" | "Catering")} className={inputCls}>
            <option value="Catering">Catering (delivery)</option>
            <option value="Pickup">Pickup</option>
          </select>
        </Label>
        <Label text="Status">
          <select name="status" defaultValue="Confirmed" className={inputCls}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Label>
        <Label text={orderType === "Catering" ? "Delivery date *" : "Pickup date *"}>
          <input name="pickup_date" type="date" required defaultValue={today} className={inputCls} />
        </Label>
        <Label text={orderType === "Catering" ? "Delivery time *" : "Pickup time *"}>
          <input name="pickup_time" type="time" required className={inputCls} />
        </Label>
        {orderType === "Catering" && (
          <Label text="Delivery address" className="sm:col-span-2">
            <textarea key={`addr-${targetId}`} name="delivery_address" rows={2} defaultValue={target?.address ?? ""} className={`${inputCls} resize-none`} />
          </Label>
        )}
        <Label text="Payment">
          <select name="payment_method" defaultValue="Credit Card" className={inputCls}>
            <option value="Credit Card">Credit card</option>
            <option value="Cash">Cash</option>
          </select>
        </Label>
      </Section>

      <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
        <h2 className="mb-3 text-lg font-extrabold">Items</h2>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key} className="rounded-xl border border-gray-300 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  aria-label="Item"
                  value={r.kind === "custom" ? "custom" : `${r.kind}:${r.itemId}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") return update(r.key, { kind: "custom", itemId: "" });
                    const [kind, itemId] = v.split(":") as [Kind, string];
                    update(r.key, { kind, itemId, qty: kind === "buffet" && Number(r.qty) < 20 ? "20" : r.qty });
                  }}
                  className={inputCls}
                >
                  <optgroup label="Bowls">
                    {PROTEINS.map((p) => (
                      <option key={p.id} value={`bowl:${p.id}`}>{p.name} Cupbop</option>
                    ))}
                  </optgroup>
                  <optgroup label="Buffet (per person)">
                    {BUFFET_PROTEINS.map((p) => (
                      <option key={p.id} value={`buffet:${p.id}`}>{p.name} Buffet</option>
                    ))}
                  </optgroup>
                  <optgroup label="Wings, sides, drinks & treats">
                    {EXTRAS.map((x) => (
                      <option key={x.id} value={`extra:${x.id}`}>{x.name}</option>
                    ))}
                  </optgroup>
                  <option value="custom">Custom item (set your own price)…</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Quantity"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={r.qty}
                    onChange={(e) => update(r.key, { qty: e.target.value })}
                    className={`${inputCls} w-20`}
                  />
                  <span className="w-20 text-right text-sm font-bold">${rowTotal(r).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== r.key) : prev))}
                    aria-label="Remove item"
                    className="text-sm font-bold text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {r.kind === "bowl" && (
                <select
                  aria-label="Spicy level"
                  value={r.spicyLevelId}
                  onChange={(e) => update(r.key, { spicyLevelId: e.target.value })}
                  className={`${inputCls} mt-2`}
                >
                  {SPICY_LEVELS.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
              )}
              {r.kind === "custom" && (
                <div className="mt-2 grid grid-cols-[1fr_8rem] gap-2">
                  <input
                    aria-label="Custom item name"
                    placeholder="Item name, e.g. Delivery fee"
                    value={r.name}
                    onChange={(e) => update(r.key, { name: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    aria-label="Unit price"
                    placeholder="Price $"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={r.price}
                    onChange={(e) => update(r.key, { price: e.target.value })}
                    className={inputCls}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          className="mt-3 rounded-full border-2 border-black px-4 py-1.5 text-sm font-bold active:bg-[#FFD200]"
        >
          + Add item
        </button>

        <div className="mt-4 space-y-2 border-t-2 border-black pt-3 text-sm">
          <div className="flex justify-between">
            <span>Menu price</span>
            <span className="font-semibold">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Price you&apos;re charging</span>
            <div className="flex items-center gap-2">
              <select
                name="discount_type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                aria-label="How to enter the price"
                className="rounded-lg border-2 border-black bg-white px-2 py-1"
              >
                <option value="total">Total $</option>
                <option value="amount">$ off</option>
                <option value="percent">% off</option>
              </select>
              <input
                name="discount_value"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder={discountType === "total" ? subtotal.toFixed(2) : "0"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-28 rounded-lg border-2 border-black px-2 py-1 text-right"
              />
            </div>
          </div>
          {discount !== 0 && (
            <div className={`flex justify-between font-semibold ${discount > 0 ? "text-green-700" : "text-amber-700"}`}>
              <span>Difference from menu</span>
              <span>{priceDifferenceLabel(subtotal, discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-extrabold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <Section title="Notes">
        <Label text="Special instructions / internal notes" className="sm:col-span-2">
          <textarea name="special_instructions" rows={3} className={`${inputCls} resize-none`} />
        </Label>
      </Section>

      {state.error && (
        <p aria-live="polite" className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl border-2 border-black bg-[#FFD200] py-4 text-base font-extrabold shadow-[0_4px_0_#000] active:translate-y-0.5 active:shadow-none disabled:opacity-60"
      >
        {pending ? "Saving…" : `Save order — $${total.toFixed(2)}`}
      </button>
      <p className="text-center text-xs text-gray-500">
        Saving emails the order to the store and admins (not the customer). Staff orders skip the online minimums and blackout dates.
      </p>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
      <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Label({ text, className = "", children }: { text: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold">{text}</span>
      {children}
    </label>
  );
}
