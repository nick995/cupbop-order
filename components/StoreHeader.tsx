"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, CART_UPDATED_EVENT, loadCart } from "@/lib/cart";
import CartDrawer from "./CartDrawer";

export default function StoreHeader() {
  const [count, setCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const update = () => setCount(cartCount(loadCart()));
    update();
    window.addEventListener(CART_UPDATED_EVENT, update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b-2 border-black bg-[#fffdf5]/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/menu" className="flex items-center gap-2">
          <Image
            src="/images/Logo.png"
            alt="Cupbop"
            width={120}
            height={40}
            priority
            className="h-9 w-auto"
          />
          <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-black sm:inline">
            Park City
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-[#FFD200] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black sm:inline-block">
            Open
          </span>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={count > 0 ? `Open cart (${count} cupbops)` : "Open cart (empty)"}
            className="relative flex h-10 items-center gap-1.5 rounded-full border-2 border-black bg-white px-3 py-1 font-bold text-black shadow-[0_2px_0_#000] transition active:translate-y-0.5 active:shadow-none hover:bg-yellow-50"
          >
            <CartIcon />
            <span className="text-sm">{count}</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-black bg-[#FFD200] px-1 text-[10px] font-extrabold text-black">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        </div>
      </header>

      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function CartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3h2l2.4 12.3a2 2 0 002 1.7h9.4a2 2 0 002-1.7L22 7H6" />
      <circle cx="9" cy="21" r="1.5" />
      <circle cx="18" cy="21" r="1.5" />
    </svg>
  );
}
