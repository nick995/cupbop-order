import Image from "next/image";
import Link from "next/link";
import HomeTagline from "@/components/HomeTagline";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#fffdf5] px-6 py-12 text-center">
      {/* Background glow blobs */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-yellow-300 opacity-55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-60 w-60 rounded-full bg-yellow-200 opacity-55 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 opacity-35 blur-3xl" />

      {/* Top bar */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4 text-[11px] font-bold uppercase tracking-[0.1em] text-black">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(22,163,74,0.6)]" />
          Open now
        </span>
        <span>Park City, UT</span>
      </header>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <Image
          src="/images/Logo.png"
          alt="Cupbop"
          width={320}
          height={120}
          priority
          className="mb-2 h-auto w-[260px] sm:w-[300px]"
          style={{ animation: "bob 4s ease-in-out infinite" }}
        />

        <span className="mb-6 inline-block rounded-full bg-[#FFD200] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-black shadow-[0_4px_12px_rgba(255,210,0,0.45)]">
          Park City
        </span>

        <HomeTagline />

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/intro"
            className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-2xl border-2 border-black bg-[#FFD200] px-7 py-4 text-lg font-bold text-black shadow-[0_6px_0_#000,0_10px_20px_rgba(0,0,0,0.15)] transition active:translate-y-1 active:shadow-[0_2px_0_#000,0_4px_8px_rgba(0,0,0,0.15)]"
          >
            Start Order
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Contact */}
        <a
          href="tel:+13853924286"
          className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-2.5 text-sm font-bold text-black shadow-[0_3px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000] hover:bg-yellow-50"
          aria-label="Call Cupbop Park City"
        >
          <span aria-hidden="true">📞</span>
          <span>(385) 392-4286</span>
        </a>
      </div>
    </main>
  );
}
