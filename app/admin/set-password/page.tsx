import type { Metadata } from "next";
import SetPasswordForm from "./SetPasswordForm";

export const metadata: Metadata = {
  title: "Set password — Cupbop Park City",
  robots: { index: false, follow: false },
};

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fffdf5] px-4">
      <div className="w-full max-w-sm rounded-2xl border-2 border-black bg-white p-6 shadow-[0_4px_0_#000]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-black">Cupbop Park City</p>
        <h1 className="mb-5 mt-1 text-2xl font-extrabold text-black">Set your password</h1>
        <SetPasswordForm />
      </div>
    </main>
  );
}
