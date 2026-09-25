"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Password-recovery links should land on /auth/confirm, but if that URL isn't
// in Supabase's redirect allowlist it silently falls back to the Site URL
// (this homepage) instead, with the recovery token stuck in the URL hash —
// which never reaches the server, so nothing would otherwise handle it.
// This catches that case and forwards to the real handler.
export default function RecoveryHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token=") || hash.includes("error_description=")) {
      router.replace(`/auth/confirm${hash}`);
    }
  }, [router]);

  return null;
}
