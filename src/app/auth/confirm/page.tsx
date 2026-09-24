"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/Wordmark";

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <AuthConfirmInner />
    </Suspense>
  );
}

function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const recovering = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Password-recovery links resolve to a session too, but should land on the
    // reset-password form instead of onboarding. Supabase fires this specific
    // event for that case (works for both hash- and code-based recovery links).
    // The flag guards against run()'s plain-session redirect below firing
    // after this one and overwriting the navigation.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recovering.current = true;
        router.replace("/reset-password");
      }
    });

    async function run() {
      const code = searchParams.get("code");

      // Magic-link and some signup-confirmation emails put the session in the URL's
      // hash fragment (#access_token=...) instead of a ?code= query param — the hash
      // never reaches a server route at all, so this has to run client-side. The
      // browser client auto-detects and consumes that hash on init (detectSessionInUrl),
      // so by the time we get here a hash-based session is often already set; we only
      // need to explicitly exchange when it's the ?code= (PKCE) style instead.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("That link is invalid or has expired.");
        return;
      }
      if (!recovering.current) router.replace("/onboarding");
    }

    run();
    return () => subscription.unsubscribe();
  }, [router, searchParams]);

  return (
    <div className="page">
      <header className="hero">
        <Wordmark />
        {error ? (
          <>
            <p className="lede">{error}</p>
            <Link href="/login" className="btn" style={{ marginTop: 16, alignSelf: "flex-start" }}>
              Back to login
            </Link>
          </>
        ) : (
          <p className="lede">Signing you in…</p>
        )}
      </header>
    </div>
  );
}
