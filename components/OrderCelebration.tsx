"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

// Deterministic pseudo-random so SSR/CSR markup match
function det(seed: number): number {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
}

const CONFETTI_COLORS = [
  "#FFD200", // brand yellow
  "#FF6B35", // orange
  "#16a34a", // green
  "#ef4444", // red
  "#3b82f6", // blue
  "#a855f7", // purple
];

interface ConfettiPiece {
  id: number;
  color: string;
  startX: number;   // px relative to image center
  endX: number;     // px relative to image center
  endY: number;     // px relative to image center
  rotate: number;
  duration: number;
  delay: number;
  shape: "square" | "circle" | "rect";
  size: number;
}

function buildConfetti(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (det(i + 1) - 0.5) * Math.PI; // -π/2 to π/2 (upward fan)
    const distance = 200 + det(i * 3) * 280;     // 200..480 px
    const startX = (det(i * 5) - 0.5) * 30;
    const endX = startX + Math.sin(angle) * distance;
    const endY = -Math.abs(Math.cos(angle) * distance) - 40; // shoot up
    const shapes: ConfettiPiece["shape"][] = ["square", "circle", "rect"];
    pieces.push({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX,
      endX,
      endY,
      rotate: (det(i * 7) - 0.5) * 720,
      duration: 1.6 + det(i * 11) * 0.9,
      delay: det(i * 13) * 0.4,
      shape: shapes[i % shapes.length],
      size: 8 + Math.floor(det(i * 17) * 8), // 8–16 px
    });
  }
  return pieces;
}

export default function OrderCelebration() {
  const shouldReduceMotion = useReducedMotion();
  const confetti = useMemo(() => buildConfetti(40), []);

  return (
    <div className="relative mx-auto mb-2 flex h-64 w-full max-w-md items-end justify-center sm:h-72">
      {/* Confetti — fired upward and outward from the bottom of the image */}
      {!shouldReduceMotion &&
        confetti.map((p) => (
          <motion.span
            key={p.id}
            className="pointer-events-none absolute"
            style={{
              left: "50%",
              bottom: "20%",
              width: p.shape === "rect" ? p.size * 1.6 : p.size,
              height: p.shape === "rect" ? p.size * 0.6 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? "50%" : 2,
            }}
            initial={{ x: p.startX, y: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: [p.startX, p.endX, p.endX + (det(p.id * 19) - 0.5) * 80],
              y: [0, p.endY, p.endY + 200], // up then fall down
              opacity: [0, 1, 1, 0],
              rotate: [0, p.rotate],
            }}
            transition={{
              duration: p.duration + 1.0,
              delay: p.delay,
              times: [0, 0.4, 0.7, 1],
              ease: "easeOut",
            }}
          />
        ))}

      {/* The mascots celebrating */}
      <motion.img
        src="/images/order-celebrate.png"
        alt="Cupbop mascots celebrating"
        initial={
          shouldReduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.4, y: 30 }
        }
        animate={
          shouldReduceMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 1, scale: 1, y: [0, -8, 0, -5, 0] }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.3 }
            : {
                opacity: { duration: 0.4 },
                scale: { type: "spring", damping: 10, stiffness: 200, delay: 0.1 },
                y: {
                  duration: 1.4,
                  delay: 0.7,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }
        }
        className="relative z-10 block h-full w-auto object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.15)]"
      />

      {/* A few extra sparkles right around the mascots */}
      {!shouldReduceMotion && (
        <>
          <motion.span
            className="pointer-events-none absolute z-20 text-3xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.3, 0] }}
            transition={{ duration: 1.4, delay: 0.5, repeat: Infinity, repeatDelay: 1.6 }}
            style={{ top: "8%", left: "18%" }}
          >
            ✨
          </motion.span>
          <motion.span
            className="pointer-events-none absolute z-20 text-3xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.3, 0] }}
            transition={{ duration: 1.4, delay: 0.9, repeat: Infinity, repeatDelay: 1.8 }}
            style={{ top: "12%", right: "18%" }}
          >
            ✨
          </motion.span>
          <motion.span
            className="pointer-events-none absolute z-20 text-2xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
            transition={{ duration: 1.2, delay: 1.3, repeat: Infinity, repeatDelay: 2.0 }}
            style={{ top: "30%", left: "8%" }}
          >
            🎉
          </motion.span>
          <motion.span
            className="pointer-events-none absolute z-20 text-2xl"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
            transition={{ duration: 1.2, delay: 1.5, repeat: Infinity, repeatDelay: 2.2 }}
            style={{ top: "32%", right: "8%" }}
          >
            🎉
          </motion.span>
        </>
      )}
    </div>
  );
}
