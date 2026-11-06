"use client";

import { useActionState, useSyncExternalStore } from "react";
import { setPasswordFromInvite } from "../actions";

interface LinkParams {
  access_token: string;
  token_hash: string;
  type: string;
  error: string;
}

// Supabase puts the token in the URL hash (#access_token=…&type=invite) or,
// with custom email templates, in the query (?token_hash=…&type=invite).
// Cached so useSyncExternalStore gets a stable snapshot.
let cached: { href: string; params: LinkParams } | null = null;
function readLink(): LinkParams {
  const href = window.location.href;
  if (cached?.href === href) return cached.params;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const get = (k: string) => hash.get(k) ?? query.get(k) ?? "";
  const params = {
    access_token: get("access_token"),
    token_hash: get("token_hash"),
    type: get("type") || "invite",
    error: get("error_description"),
  };
  cached = { href, params };
  return params;
}
const noSubscribe = () => () => {};

export default function SetPasswordForm() {
  const link = useSyncExternalStore(noSubscribe, readLink, () => null);
  const [state, formAction, pending] = useActionState(setPasswordFromInvite, {});

  if (!link) return null;
  if (link.error || (!link.access_token && !link.token_hash)) {
    return (
      <p className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
        {link.error || "This link is invalid or has expired."} Ask an admin to send a new invite.
      </p>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-4">
      <input type="hidden" name="access_token" value={link.access_token} />
      <input type="hidden" name="token_hash" value={link.token_hash} />
      <input type="hidden" name="type" value={link.type} />
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-black">New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full rounded-xl border-2 border-black bg-white px-3 py-2.5 text-base"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-black">Confirm password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
        {pending ? "Saving…" : "Set password & sign in"}
      </button>
    </form>
  );
}
