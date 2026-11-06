"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import StoreHeader from "@/components/StoreHeader";
import {
  BOWL_MODS,
  BUFFET_PROTEINS,
  CATERING_MIN_SERVINGS,
  DEFAULT_SPICY_ID,
  EXTRA_CATEGORIES,
  EXTRAS,
  ExtraItem,
  MAX_LINE_QTY,
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
  const [active, setActive] = useState<Selection | null>(null);
  const [draftSpicy, setDraftSpicy] = useState<string>(DEFAULT_SPICY_ID);
  const [draftMods, setDraftMods] = useState<string[]>([]);
  const [draftQty, setDraftQty] = useState<number>(1);

  useEffect(() => {
    setLines(loadCart());
    setMounted(true);
  }, []);

  const openCustomize = (selection: Selection) => {
    setActive(selection);
    setDraftSpicy(DEFAULT_SPICY_ID);
    setDraftMods([]);
    setDraftQty(selection.kind === "buffet" ? CATERING_MIN_SERVINGS : 1);
  };

  const closeCustomize = () => setActive(null);

  const toggleMod = (id: string) => {
    setDraftMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const addToCart = () => {
    if (!active) return;
    const newLine: CartLine = {
      id: newLineId(),
      kind: active.kind,
      itemId: active.item.id,
      ...(active.kind !== "extra" && { spicyLevelId: draftSpicy }),
      modIds: active.kind === "bowl" ? draftMods : [],
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
        <p className="mb-4 text-sm font-semibold text-black">
          1. Pick a protein → 2. Choose your spicy level → 3. Set quantity
        </p>

        <nav className="sticky top-0 z-20 -mx-4 mb-5 flex gap-2 overflow-x-auto bg-[#fffdf5]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="shrink-0 rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold text-black hover:bg-yellow-50"
            >
              {sec.title}
            </a>
          ))}
        </nav>

        <MenuSection id="bowls" title="Bowls">
          {PROTEINS.map((p) => (
            <ItemCard
              key={p.id}
              item={p}
              price={priceForProtein(p.id)}
              onClick={() => openCustomize({ kind: "bowl", item: p })}
            />
          ))}
        </MenuSection>

        <MenuSection
          id="buffet"
          title="Buffet"
          note={`Catering only. Served family-style in trays, priced per person. Counts toward the ${CATERING_MIN_SERVINGS}-serving catering minimum.`}
        >
          {BUFFET_PROTEINS.map((p) => (
            <ItemCard
              key={p.id}
              item={{ ...p, name: `${p.name} Buffet` }}
              price={priceForProtein(p.id)}
              priceSuffix="/person"
              onClick={() => openCustomize({ kind: "buffet", item: p })}
            />
          ))}
        </MenuSection>

        {EXTRA_CATEGORIES.map((category) => (
          <MenuSection key={category} id={sectionId(category)} title={category}>
            {EXTRAS.filter((e) => e.category === category).map((e) => (
              <ItemCard
                key={e.id}
                item={e}
                price={e.price}
                onClick={() => openCustomize({ kind: "extra", item: e })}
              />
            ))}
          </MenuSection>
        ))}
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
        {active && (
          <CustomizeSheet
            selection={active}
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

type Selection =
  | { kind: "bowl" | "buffet"; item: Protein }
  | { kind: "extra"; item: ExtraItem };

const SECTIONS = [
  { id: "bowls", title: "Bowls" },
  { id: "buffet", title: "Buffet" },
  ...EXTRA_CATEGORIES.map((c) => ({ id: sectionId(c), title: c })),
];

function sectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z]+/g, "-");
}

function MenuSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-16">
      <h2 className="mb-1 text-xl font-extrabold text-black">{title}</h2>
      {note && <p className="mb-3 text-xs text-gray-600">{note}</p>}
      <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${note ? "" : "mt-3"}`}>{children}</ul>
    </section>
  );
}

function ItemCard({
  item,
  price,
  priceSuffix,
  onClick,
}: {
  item: Pick<Protein, "name" | "description" | "imageUrl" | "emoji"> &
    Partial<Pick<Protein, "isPopular" | "isGlutenFree" | "upcharge">>;
  price: number;
  priceSuffix?: string;
  onClick: () => void;
}) {
  return (
    <li className="relative h-full">
      {item.isPopular && (
        <span className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#FFD200] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-[0_2px_0_#000]">
          ⭐ Popular
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        className="flex h-full min-h-[110px] w-full items-center gap-3 rounded-2xl border-2 border-black bg-white p-4 text-left shadow-[0_4px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000] hover:bg-yellow-50"
      >
        <ItemImage src={item.imageUrl} alt={item.name} emoji={item.emoji} className="h-16 w-16 text-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-base font-bold text-black sm:text-lg">{item.name}</h3>
              {item.isGlutenFree && (
                <span className="shrink-0 rounded-md bg-green-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                  GF
                </span>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold text-black">
              ${price.toFixed(2)}
              {priceSuffix && <span className="text-[11px] font-semibold text-gray-600">{priceSuffix}</span>}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 sm:text-sm">{item.description}</p>
          {(item.upcharge ?? 0) > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              +${item.upcharge!.toFixed(2)} upcharge
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function ItemImage({ src, alt, emoji, className }: { src: string; alt: string; emoji: string; className: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-yellow-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) parent.textContent = emoji;
        }}
      />
    </div>
  );
}

interface CustomizeSheetProps {
  selection: Selection;
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
  selection,
  spicyId,
  modIds,
  qty,
  onSpicyChange,
  onToggleMod,
  onQtyChange,
  onClose,
  onAdd,
}: CustomizeSheetProps) {
  const { kind, item } = selection;
  const unitPrice = selection.kind === "extra" ? selection.item.price : priceForProtein(selection.item.id);
  const title = kind === "bowl" ? `${item.name} Cupbop` : kind === "buffet" ? `${item.name} Buffet` : item.name;
  const minQty = 1;
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
            <ItemImage src={item.imageUrl} alt={item.name} emoji={item.emoji} className="h-14 w-14 text-2xl" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-black">
                  {title}
                </h2>
                {"isGlutenFree" in item && item.isGlutenFree && (
                  <span className="rounded-md bg-green-600 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                    GF
                  </span>
                )}
                {kind === "bowl" && item.isPopular && (
                  <span className="rounded-md bg-[#FFD200] border border-black px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-black">
                    ⭐
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                {item.description}
                {kind === "buffet" && " · Served family-style, priced per person"}
              </p>
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
          {kind !== "extra" && (<>
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
          </>)}

          {kind === "bowl" && (<>
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
          </>)}

          <div className={`${kind === "extra" ? "" : "mt-6 "}flex items-center justify-between`}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-black">
              {kind === "buffet" ? "People" : "Quantity"}
            </h3>
            <div className="inline-flex items-center gap-3 rounded-full border-2 border-black bg-white px-2 py-1 shadow-[0_2px_0_#000]">
              <button
                type="button"
                onClick={() => onQtyChange(Math.max(minQty, qty - 1))}
                aria-label="Decrease"
                disabled={qty <= minQty}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-black hover:bg-gray-100 disabled:opacity-40"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={minQty}
                max={MAX_LINE_QTY}
                value={qty}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  onQtyChange(Number.isFinite(n) ? Math.min(MAX_LINE_QTY, Math.max(minQty, n)) : minQty);
                }}
                aria-label={kind === "buffet" ? "Number of people" : "Quantity"}
                className="w-14 bg-transparent text-center text-base font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => onQtyChange(Math.min(MAX_LINE_QTY, qty + 1))}
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
              {qty} × {item.name}
              {kind !== "extra" && spicy ? ` · ${spicy.name}` : ""}
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

