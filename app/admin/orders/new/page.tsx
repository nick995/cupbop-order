import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { storeToday } from "@/lib/orderActions";
import NewOrderForm from "./NewOrderForm";

export const metadata: Metadata = {
  title: "New order — Cupbop Park City admin",
  robots: { index: false, follow: false },
};

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { data } = await getSupabaseServerClient()
    .from("catering_targets")
    .select("id, name, address, phone")
    .order("name")
    .limit(500);

  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-[#FFD200] px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">Cupbop Park City</p>
          <h1 className="text-xl font-extrabold">New order</h1>
        </div>
        <Link href="/admin" className="text-sm font-bold underline">
          ← Orders
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <NewOrderForm
          today={storeToday()}
          targets={data ?? []}
          initialTargetId={typeof params.target === "string" ? params.target : ""}
        />
      </main>
    </div>
  );
}
