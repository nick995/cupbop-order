"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction} className="w-full space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-black">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-black">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-base"
        />
      </label>
      {state.error && (
        <p aria-live="polite" className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full border-2 border-black bg-[#FFD200] py-3 text-base font-extrabold text-black shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
