"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface CupbopDeliveryIntroProps {
  redirectTo?: string;
  durationMs?: number;
}

export default function CupbopDeliveryIntro({
  redirectTo = "/menu",
  durationMs = 3000,
}: CupbopDeliveryIntroProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(redirectTo);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [router, redirectTo, durationMs]);

  const handleSkip = () => router.push(redirectTo);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-screen min-h-[100svh] w-full flex-col items-center overflow-hidden bg-gradient-to-b from-sky-100 via-yellow-50 to-yellow-100"
      role="dialog"
      aria-label="Cupbop delivery intro"
    >
      <button
        onClick={handleSkip}
        className="absolute right-4 top-4 z-40 rounded-full border-2 border-black bg-white px-4 py-1.5 text-sm font-bold text-black shadow-[0_3px_0_#000] transition active:translate-y-0.5 active:shadow-[0_1px_0_#000]"
      >
        Skip →
      </button>

      {/* ---------- SCENE ---------- */}
      <div className="relative w-full flex-1 overflow-hidden">
        {/* Sun */}
        <div className="pointer-events-none absolute right-8 top-10 z-0 h-20 w-20 rounded-full bg-yellow-300 blur-md sm:right-16 sm:top-14 sm:h-24 sm:w-24" />
        <div className="pointer-events-none absolute right-[2.5rem] top-[3.25rem] z-0 h-14 w-14 rounded-full bg-yellow-400 sm:right-[4.5rem] sm:top-[4.5rem] sm:h-16 sm:w-16" />

        {/* Drifting clouds */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              className="absolute top-12 z-0 h-6 w-20 rounded-full bg-white/85"
              initial={{ x: -100 }}
              animate={{ x: "120vw" }}
              transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute top-24 z-0 h-5 w-14 rounded-full bg-white/70"
              initial={{ x: -50 }}
              animate={{ x: "120vw" }}
              transition={{
                duration: 35,
                repeat: Infinity,
                ease: "linear",
                delay: 8,
              }}
            />
            <motion.div
              className="absolute top-6 z-0 h-4 w-12 rounded-full bg-white/60"
              initial={{ x: -30 }}
              animate={{ x: "120vw" }}
              transition={{
                duration: 40,
                repeat: Infinity,
                ease: "linear",
                delay: 15,
              }}
            />
          </>
        )}

        {/* Park City mountains — back layer */}
        <svg
          className="pointer-events-none absolute bottom-[38%] left-0 right-0 z-[1] h-24 w-full sm:h-32"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points="0,100 50,45 90,60 140,25 190,55 240,20 290,50 340,30 400,55 400,100"
            fill="#a8b3c4"
            opacity="0.55"
          />
        </svg>

        {/* Park City mountains — front layer (darker, snow caps) */}
        <svg
          className="pointer-events-none absolute bottom-[32%] left-0 right-0 z-[2] h-20 w-full sm:h-28"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points="0,100 70,55 110,70 170,30 230,65 290,35 350,55 400,40 400,100"
            fill="#6b7a8f"
            opacity="0.75"
          />
          {/* snow caps */}
          <polygon points="160,38 170,30 180,38" fill="#fff" opacity="0.9" />
          <polygon points="280,42 290,35 300,42" fill="#fff" opacity="0.9" />
        </svg>

        {/* Ground / grass strip behind sidewalk */}
        <div className="absolute bottom-[28%] left-0 right-0 z-[3] h-3 bg-green-300/60" />

        {/* ROAD with perspective */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[4] h-[28%] overflow-hidden"
          style={{
            perspective: "240px",
            perspectiveOrigin: "50% 0%",
          }}
        >
          <div
            className="absolute inset-x-[-40%] top-0 h-[600px] bg-stone-700"
            style={{
              transform: "rotateX(65deg)",
              transformOrigin: "50% 0%",
            }}
          >
            {/* White edge lines */}
            <div className="absolute left-[18%] top-0 h-full w-1 bg-white/80" />
            <div className="absolute right-[18%] top-0 h-full w-1 bg-white/80" />

            {/* Animated yellow dashed center line */}
            <div
              className="absolute left-1/2 top-0 h-full w-2 -translate-x-1/2"
              style={{
                background:
                  "repeating-linear-gradient(to bottom, #FFD200 0px, #FFD200 30px, transparent 30px, transparent 60px)",
                animation: shouldReduceMotion
                  ? undefined
                  : "road-scroll 0.5s linear infinite",
              }}
            />
          </div>
        </div>

        {/* Text — sits right above the truck */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="absolute bottom-[70%] left-0 right-0 z-20 px-6 text-center"
        >
          <p className="text-2xl font-extrabold text-black sm:text-3xl">
            On our way to take your order!
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-gray-700">
            Cupbop Park City
          </p>
        </motion.div>

        {/* TRUCK — center foreground */}
        <motion.img
          src="/images/cupbop-truck.png"
          alt="Cupbop delivery truck"
          initial={
            shouldReduceMotion
              ? { opacity: 0, scale: 1, x: "-50%" }
              : { opacity: 0, scale: 0.7, x: "-50%", y: 30 }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1, scale: 1, x: "-50%", y: 0 }
              : { opacity: 1, scale: 1, x: "-50%", y: [0, -6, 0, -4, 0] }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.3 }
              : {
                  opacity: { duration: 0.4 },
                  scale: { duration: 0.7, ease: "easeOut" },
                  y: {
                    duration: 0.9,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.8,
                  },
                }
          }
          className="absolute bottom-[14%] left-1/2 z-[10] h-[44svh] w-auto max-w-[88%] object-contain sm:h-[50svh]"
        />
      </div>

    </motion.div>
  );
}
