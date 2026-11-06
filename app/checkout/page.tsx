"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import { findBowlMod, findProtein, findSpicy, priceForProtein } from "@/lib/menu";
import {
  CartLine,
  cartCount,
  cartSubtotal,
  clearCart,
  lineSubtotal,
  loadCart,
  removeLine,
} from "@/lib/cart";

const CATERING_MIN_BOWLS = 15;

type OrderType = "Pickup" | "Catering";
type PaymentMethod = "Cash" | "Credit Card";

interface FormState {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: OrderType;
  pickup_date: string;
  pickup_time: string;
  delivery_address: string;
  payment_method: PaymentMethod;
  special_instructions: string;
}

const INITIAL: FormState = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  order_type: "Pickup",
  pickup_date: "",
  pickup_time: "",
  delivery_address: "",
  payment_method: "Cash",
  special_instructions: "",
};

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fffdf5]" />}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType: OrderType = params.get("type") === "catering" ? "Catering" : "Pickup";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>({ ...INITIAL, order_type: initialType });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = loadCart();
    setLines(c);
    setMounted(true);
    if (c.length === 0) {
      router.replace("/menu");
    }
  }, [router]);

  const subtotal = useMemo(() => cartSubtotal(lines), [lines]);
  const totalBowls = useMemo(() => cartCount(lines), [lines]);
  const isCatering = form.order_type === "Catering";
  const bowlsShort = isCatering ? Math.max(0, CATERING_MIN_BOWLS - totalBowls) : 0;
  const minDate = todayISO();

  const onChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customer_name.trim()) return setError("Please enter your name.");
    if (!/^[0-9+\-\s()]{7,}$/.test(form.customer_phone))
      return setError("Please enter a valid phone number.");
    if (!/^\S+@\S+\.\S+$/.test(form.customer_email))
      return setError("Please enter a valid email address.");

    if (isCatering) {
      if (totalBowls < CATERING_MIN_BOWLS)
        return setError(
          `Catering orders require at least ${CATERING_MIN_BOWLS} bowls. You currently have ${totalBowls}.`
        );
      if (!form.delivery_address.trim())
        return setError("Please enter the delivery address.");
      if (!form.pickup_date) return setError("Please choose a delivery date.");
      if (!form.pickup_time) return setError("Please choose a delivery time.");
    } else {
      if (!form.pickup_date) return setError("Please choose a pickup date.");
      if (!form.pickup_time) return setError("Please choose a pickup time.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subtotal,
          items: lines.map((l) => {
            const protein = findProtein(l.proteinId);
            const spicy = findSpicy(l.spicyLevelId);
            return {
              lineId: l.id,
              proteinId: l.proteinId,
              proteinName: protein?.name ?? l.proteinId,
              spicyLevelId: l.spicyLevelId,
              spicyLevel: spicy?.fullName ?? l.spicyLevelId,
              modIds: l.modIds,
              mods: l.modIds.map((id) => findBowlMod(id)?.name ?? id),
              qty: l.qty,
              unitPrice: priceForProtein(l.proteinId),
              lineTotal: lineSubtotal(l),
            };
          }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not submit order. Please try again.");
      }

      const data = await res.json();
      clearCart();
      router.push(`/order-confirmation?id=${encodeURIComponent(data.id ?? "")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffdf5]">
      <StoreHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6 sm:px-6">
        <h1 className="mb-1 text-3xl font-extrabold text-black sm:text-4xl">
          Checkout
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          We&apos;ll confirm your order request by email.
        </p>

        {/* Order summary */}
        <section className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-[0_4px_0_#000]">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-black">
            Your Order
          </h2>
          <ul className="divide-y divide-gray-200">
            {lines.map((l) => {
              const protein = findProtein(l.proteinId);
              const spicy = findSpicy(l.spicyLevelId);
              const modNames = l.modIds
                .map((id) => findBowlMod(id)?.name)
                .filter(Boolean) as string[];
              if (!protein) return null;
              return (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black">
                      {l.qty}× {protein.name} Cupbop
                    </div>
                    {spicy && (
                      <div className="text-xs text-gray-600">
                        {spicy.name}
                        {spicy.description ? ` · ${spicy.description}` : ""}
                      </div>
                    )}
                    {modNames.length > 0 && (
                      <div className="text-xs font-semibold text-amber-700">
                        Modifications: {modNames.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold">
                      ${lineSubtotal(l).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = removeLine(l.id);
                        setLines(next);
                        if (next.length === 0) router.replace("/menu");
                      }}
                      aria-label={`Remove ${protein.name} Cupbop`}
                      className="text-[11px] font-semibold text-red-600 underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t-2 border-black pt-3 text-base font-extrabold">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Your name" required>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => onChange("customer_name", e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              className={inputCls}
            />
          </Field>

          <Field label="Phone number" required>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={(e) => onChange("customer_phone", e.target.value)}
              placeholder="(435) 555-0123"
              autoComplete="tel"
              className={inputCls}
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => onChange("customer_email", e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </Field>

          <Field label="Order type" required>
            <ToggleGroup
              value={form.order_type}
              onChange={(v) => onChange("order_type", v as OrderType)}
              options={["Pickup", "Catering"]}
              labelMap={{
                Pickup: "Pickup at store",
                Catering: "Catering (delivery)",
              }}
            />
          </Field>

          {isCatering && (
            <div
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
                bowlsShort > 0
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-green-600 bg-green-50 text-green-800"
              }`}
            >
              {bowlsShort > 0 ? (
                <>
                  Catering minimum is{" "}
                  <strong>{CATERING_MIN_BOWLS} bowls</strong>. You have{" "}
                  <strong>{totalBowls}</strong> — please add{" "}
                  <strong>{bowlsShort} more</strong>.
                  <button
                    type="button"
                    onClick={() => router.push("/menu?type=catering")}
                    className="ml-2 underline"
                  >
                    Add more →
                  </button>
                </>
              ) : (
                <>✓ Catering minimum met ({totalBowls} bowls).</>
              )}
            </div>
          )}

          {isCatering && (
            <Field label="Delivery address" required>
              <textarea
                value={form.delivery_address}
                onChange={(e) =>
                  onChange("delivery_address", e.target.value)
                }
                placeholder="Street address, suite/apt, city, ZIP"
                rows={3}
                autoComplete="street-address"
                className={`${inputCls} resize-none`}
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={isCatering ? "Delivery date" : "Pickup date"}
              required
            >
              <input
                type="date"
                value={form.pickup_date}
                min={minDate}
                onChange={(e) => onChange("pickup_date", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field
              label={isCatering ? "Delivery time" : "Pickup time"}
              required
            >
              <input
                type="time"
                value={form.pickup_time}
                onChange={(e) => onChange("pickup_time", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Payment method" required>
            <ToggleGroup
              value={form.payment_method}
              onChange={(v) => onChange("payment_method", v as PaymentMethod)}
              options={["Cash", "Credit Card"]}
              labelMap={{
                Cash: "Cash",
                "Credit Card": "Credit card",
              }}
            />
            <p className="mt-2 rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-black">
              Payment will be completed at the store. Your order request will be
              confirmed by Cupbop Park City.
            </p>
          </Field>

          <Field label="Special instructions">
            <textarea
              value={form.special_instructions}
              onChange={(e) =>
                onChange("special_instructions", e.target.value)
              }
              placeholder="No onions, extra sauce, etc."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>

          {error && (
            <p className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl border-2 border-black bg-[#FFD200] px-5 py-4 text-base font-extrabold text-black shadow-[0_6px_0_#000] transition active:translate-y-1 active:shadow-[0_2px_0_#000] disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit Order Request →"}
          </button>
        </form>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-base text-black placeholder-gray-400 outline-none focus:ring-4 focus:ring-yellow-300";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-black">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ToggleGroup({
  value,
  onChange,
  options,
  labelMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelMap?: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-xl border-2 border-black px-3 py-3 text-sm font-bold transition ${
              active
                ? "bg-[#FFD200] text-black shadow-[0_3px_0_#000]"
                : "bg-white text-black hover:bg-yellow-50"
            }`}
          >
            {labelMap?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}
