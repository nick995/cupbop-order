import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminEmail } from "@/lib/adminAuth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin sign in — Cupbop Park City",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getAdminEmail()) redirect("/admin");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fffdf5] px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-black bg-white p-6 shadow-[0_4px_0_#000]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-black">Cupbop Park City</p>
        <h1 className="mb-5 mt-1 text-2xl font-extrabold text-black">Store admin</h1>
        <LoginForm />
      </div>
      <Link href="/" className="mt-5 text-sm font-bold text-gray-600 underline hover:text-black">
        ← Back to main page
      </Link>
    </main>
  );
}
