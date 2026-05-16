"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function HomeTagline() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.4, y: 20 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.3 }
          : { type: "spring", damping: 11, stiffness: 180, delay: 0.4 }
      }
      className="mb-9 w-full max-w-[300px] sm:max-w-[340px]"
    >
      {/* Inner motion handles the continuous gentle sway after the spring entry settles. */}
      <motion.img
        src="/images/Korean-sprit-in-a-cup.png"
        alt="Korean Spirit in a Cup"
        initial={{ rotate: 0 }}
        animate={shouldReduceMotion ? { rotate: 0 } : { rotate: [-2.5, 2.5] }}
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 3.2,
                delay: 1.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }
        }
        className="block w-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.08)]"
      />
    </motion.div>
  );
}
