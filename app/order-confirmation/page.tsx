"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import StoreHeader from "@/components/StoreHeader";
import OrderCelebration from "@/components/OrderCelebration";

function ConfirmationInner() {
  const params = useSearchParams();
  const id = params.get("id");

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#fffdf5]">
      <StoreHeader />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 pb-12 pt-6 text-center sm:px-6">
        <OrderCelebration />

        <h1 className="mb-2 text-3xl font-extrabold text-black sm:text-4xl">
          Order Request Sent!
        </h1>
        <p className="mb-6 text-base text-gray-700">
          Thanks — we&apos;ve received your order request.
        </p>

        <section className="w-full rounded-2xl border-2 border-black bg-white p-5 text-left shadow-[0_4px_0_#000]">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-black">
            What happens next
          </p>
          <ol className="space-y-2 text-sm text-gray-800">
            <li>
              <strong>1.</strong> Cupbop Park City will confirm your order by
              email shortly.
            </li>
            <li>
              <strong>2.</strong> Show up at your pickup time at our Park City
              location.
            </li>
            <li>
              <strong>3.</strong> Pay at the store (cash or credit card).
            </li>
          </ol>

          {id && (
            <p className="mt-4 rounded-lg bg-yellow-100 px-3 py-2 text-xs font-semibold text-black">
              Reference: <span className="font-mono">{id}</span>
            </p>
          )}
        </section>

        <p className="mt-6 text-xs text-gray-500">
          Payment will be completed at the store. Your order request will be
          confirmed by Cupbop Park City.
        </p>

        <Link
          href="/menu"
          className="mt-8 inline-block rounded-2xl border-2 border-black bg-white px-6 py-3 text-sm font-bold text-black shadow-[0_4px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000]"
        >
          ← Back to menu
        </Link>
      </main>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fffdf5]" />}>
      <ConfirmationInner />
    </Suspense>
  );
}
