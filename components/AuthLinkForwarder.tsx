"use client";

import { useEffect } from "react";

// Supabase invite / reset emails redirect to the Site URL (the homepage) with
// the token in the URL hash. Send those visitors to the set-password page.
export default function AuthLinkForwarder() {
  useEffect(() => {
    const hash = window.location.hash;
    if (/[#&](access_token|error_description)=/.test(hash)) {
      window.location.replace(`/admin/set-password${hash}`);
    }
  }, []);
  return null;
}
