"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import StoreHeader from "@/components/StoreHeader";
import {
  BOWL_MODS,
  DEFAULT_SPICY_ID,
  findSpicy,
  PROTEINS,
  Protein,
  SPICY_LEVELS,
  priceForProtein,
} from "@/lib/menu";
import {
  CartLine,
  cartCount,
  cartSubtotal,
  loadCart,
  newLineId,
  saveCart,
} from "@/lib/cart";

export default function MenuPage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeProtein, setActiveProtein] = useState<Protein | null>(null);
  const [draftSpicy, setDraftSpicy] = useState<string>(DEFAULT_SPICY_ID);
  const [draftMods, setDraftMods] = useState<string[]>([]);
  const [draftQty, setDraftQty] = useState<number>(1);

  useEffect(() => {
    setLines(loadCart());
    setMounted(true);
  }, []);

  const openCustomize = (p: Protein) => {
    setActiveProtein(p);
    setDraftSpicy(DEFAULT_SPICY_ID);
    setDraftMods([]);
    setDraftQty(1);
  };

  const closeCustomize = () => setActiveProtein(null);

  const toggleMod = (id: string) => {
    setDraftMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const addToCart = () => {
    if (!activeProtein) return;
    const newLine: CartLine = {
      id: newLineId(),
      proteinId: activeProtein.id,
      spicyLevelId: draftSpicy,
      modIds: draftMods,
      qty: draftQty,
    };
    setLines((prev) => {
      const next = [...prev, newLine];
      saveCart(next);
      return next;
    });
    closeCustomize();
  };

  const count = mounted ? cartCount(lines) : 0;
  const subtotal = mounted ? cartSubtotal(lines) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffdf5]">
      <StoreHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-6 sm:px-6">
        <h1 className="mb-1 text-3xl font-extrabold text-black sm:text-4xl">
          Build Your Cupbop
        </h1>
        <p className="mb-2 text-sm text-gray-600">
          Each Cupbop comes with rice, cabbage, and noodles.
        </p>
        <p className="mb-6 text-sm font-semibold text-black">
          1. Pick a protein → 2. Choose your spicy level → 3. Set quantity
        </p>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROTEINS.map((p) => {
            const price = priceForProtein(p.id);
            return (
              <li key={p.id} className="relative h-full">
                {p.isPopular && (
                  <span className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#FFD200] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-[0_2px_0_#000]">
                    ⭐ Popular
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openCustomize(p)}
                  className="flex h-full min-h-[110px] w-full items-center gap-3 rounded-2xl border-2 border-black bg-white p-4 text-left shadow-[0_4px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000] hover:bg-yellow-50"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-3xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) parent.textContent = p.emoji;
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h2 className="truncate text-base font-bold text-black sm:text-lg">
                          {p.name}
                        </h2>
                        {p.isGlutenFree && (
                          <span className="shrink-0 rounded-md bg-green-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                            GF
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-bold text-black">
                        ${price.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 sm:text-sm">
                      {p.description}
                    </p>
                    {p.upcharge > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        +${p.upcharge.toFixed(2)} upcharge
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      {/* Sticky checkout bar */}
      {mounted && count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-black bg-[#fffdf5]/95 p-4 backdrop-blur">
          <button
            onClick={() => router.push("/checkout")}
            className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border-2 border-black bg-[#FFD200] px-5 py-4 font-bold text-black shadow-[0_4px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000]"
          >
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-black px-2.5 py-0.5 text-xs text-[#FFD200]">
                {count}
              </span>
              <span>Checkout</span>
            </span>
            <span>${subtotal.toFixed(2)} →</span>
          </button>
        </div>
      )}

      {/* Customize sheet */}
      <AnimatePresence>
        {activeProtein && (
          <CustomizeSheet
            protein={activeProtein}
            spicyId={draftSpicy}
            modIds={draftMods}
            qty={draftQty}
            onSpicyChange={setDraftSpicy}
            onToggleMod={toggleMod}
            onQtyChange={setDraftQty}
            onClose={closeCustomize}
            onAdd={addToCart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface CustomizeSheetProps {
  protein: Protein;
  spicyId: string;
  modIds: string[];
  qty: number;
  onSpicyChange: (id: string) => void;
  onToggleMod: (id: string) => void;
  onQtyChange: (n: number) => void;
  onClose: () => void;
  onAdd: () => void;
}

function CustomizeSheet({
  protein,
  spicyId,
  modIds,
  qty,
  onSpicyChange,
  onToggleMod,
  onQtyChange,
  onClose,
  onAdd,
}: CustomizeSheetProps) {
  const unitPrice = priceForProtein(protein.id);
  const total = unitPrice * qty;
  const spicy = findSpicy(spicyId);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-black bg-[#fffdf5] shadow-[0_-8px_24px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#fffdf5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={protein.imageUrl}
                alt={protein.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.textContent = protein.emoji;
                    parent.classList.add("text-2xl");
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-black">
                  {protein.name} Cupbop
                </h2>
                {protein.isGlutenFree && (
                  <span className="rounded-md bg-green-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                    GF
                  </span>
                )}
                {protein.isPopular && (
                  <span className="rounded-md bg-[#FFD200] border border-black px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-black">
                    ⭐
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">{protein.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-lg font-bold text-black shadow-[0_2px_0_#000] active:translate-y-0.5 active:shadow-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-black">
            Spicy Level
          </h3>
          <p className="mb-3 text-xs text-gray-600">
            Choose one. Default is Level 5 — Medium.
          </p>
          <ul className="space-y-2">
            {SPICY_LEVELS.map((s) => {
              const active = s.id === spicyId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSpicyChange(s.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 border-black px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-[#FFD200] shadow-[0_3px_0_#000]"
                        : "bg-white hover:bg-yellow-50"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                        active ? "bg-black" : "bg-white"
                      }`}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FFD200]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-black">
                        {s.name}
                      </span>
                      {s.description && (
                        <span className="block text-xs text-gray-700">
                          {s.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0" aria-hidden="true">
                      {"🌶️".repeat(s.heat) || "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wider text-black">
            Customize Bowl
          </h3>
          <p className="mb-3 text-xs text-gray-600">
            Base bowl comes with rice, cabbage mix, and noodles. Remove any you don&apos;t want (optional).
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {BOWL_MODS.map((m) => {
              const active = modIds.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onToggleMod(m.id)}
                    aria-pressed={active}
                    className={`flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-black px-2 py-3 text-xs font-bold transition ${
                      active
                        ? "bg-[#FFD200] shadow-[0_3px_0_#000]"
                        : "bg-white hover:bg-yellow-50"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-yellow-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt={m.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                    <span className="text-center text-[11px] leading-tight text-black">
                      {m.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              Quantity
            </h3>
            <div className="inline-flex items-center gap-3 rounded-full border-2 border-black bg-white px-2 py-1 shadow-[0_2px_0_#000]">
              <button
                type="button"
                onClick={() => onQtyChange(Math.max(1, qty - 1))}
                aria-label="Decrease"
                disabled={qty <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-black hover:bg-gray-100 disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-base font-bold">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => onQtyChange(Math.min(20, qty + 1))}
                aria-label="Increase"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD200] text-lg font-bold text-black hover:brightness-95"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t-2 border-black bg-[#fffdf5] px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <span className="text-gray-700">
              {qty} × {protein.name}
              {spicy ? ` · ${spicy.name}` : ""}
            </span>
            <span className="font-bold text-black">${total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-2xl border-2 border-black bg-[#FFD200] px-5 py-4 text-base font-extrabold text-black shadow-[0_5px_0_#000] transition active:translate-y-1 active:shadow-[0_1px_0_#000]"
          >
            Add to Order — ${total.toFixed(2)}
          </button>
        </div>
      </motion.div>
    </>
  );
}

