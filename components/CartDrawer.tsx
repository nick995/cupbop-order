"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CartLine,
  CART_UPDATED_EVENT,
  cartSubtotal,
  lineSubtotal,
  loadCart,
  removeLine,
} from "@/lib/cart";
import { findBowlMod, findProtein, findSpicy } from "@/lib/menu";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    const update = () => setLines(loadCart());
    update();
    window.addEventListener(CART_UPDATED_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close with Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subtotal = cartSubtotal(lines);

  const handleCheckout = () => {
    onClose();
    router.push("/checkout");
  };

  const handleBrowse = () => {
    onClose();
    router.push("/menu");
  };

  const handleRemove = (id: string) => {
    setLines(removeLine(id));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45"
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-2 border-black bg-[#fffdf5] shadow-[-8px_0_24px_rgba(0,0,0,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black px-5 py-4">
              <h2 className="text-lg font-extrabold text-black">Your Cart</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-lg font-bold text-black shadow-[0_2px_0_#000] active:translate-y-0.5 active:shadow-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 text-5xl" aria-hidden="true">
                  🛒
                </div>
                <p className="mb-1 text-base font-bold text-black">
                  Your cart is empty
                </p>
                <p className="mb-6 text-sm text-gray-600">
                  Pick a Cupbop to get started.
                </p>
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="rounded-2xl border-2 border-black bg-[#FFD200] px-6 py-3 text-sm font-extrabold text-black shadow-[0_4px_0_#000] active:translate-y-0.5 active:shadow-[0_1px_0_#000]"
                >
                  Browse Menu →
                </button>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-gray-200 overflow-y-auto px-5">
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
                      className="flex items-start justify-between gap-3 py-3 text-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-yellow-100 text-2xl">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={protein.imageUrl}
                            alt=""
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              if (t.parentElement) t.parentElement.textContent = protein.emoji;
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-black">
                            {l.qty}× {protein.name} Cupbop
                          </div>
                          {spicy && (
                            <div className="text-xs text-gray-600">
                              {spicy.name}
                            </div>
                          )}
                          {modNames.length > 0 && (
                            <div className="text-xs font-semibold text-amber-700">
                              {modNames.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-semibold">
                          ${lineSubtotal(l).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(l.id)}
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
            )}

            {/* Footer */}
            {lines.length > 0 && (
              <div className="border-t-2 border-black bg-[#fffdf5] px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between text-base font-extrabold text-black">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full rounded-2xl border-2 border-black bg-[#FFD200] px-5 py-4 text-base font-extrabold text-black shadow-[0_5px_0_#000] transition active:translate-y-1 active:shadow-[0_1px_0_#000]"
                >
                  Checkout →
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
