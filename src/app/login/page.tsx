"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInWithPassword, signUpWithPassword, sendMagicLink } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "magic">("login");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    mode === "signup" ? signUpWithPassword : signInWithPassword,
    null
  );
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, null);

  return (
    <div className="page">
      <header className="hero">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
        <p className="lede">{mode === "signup" ? "Start your hoshigo." : "Welcome back."}</p>
      </header>

      <section style={{ maxWidth: 420 }}>
        <div className="menu" style={{ marginBottom: 24 }}>
          <button type="button" className="btn" onClick={() => setMode("login")} disabled={mode === "login"}>
            Log in
          </button>
          <button type="button" className="btn" onClick={() => setMode("signup")} disabled={mode === "signup"}>
            Sign up
          </button>
          <button type="button" className="btn" onClick={() => setMode("magic")} disabled={mode === "magic"}>
            Magic link
          </button>
        </div>

        {mode === "magic" ? (
          <form action={magicAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            {magicState && <p className={magicState.startsWith("Check") ? "bio" : "error"}>{magicState}</p>}
            <button type="submit" className="cta" disabled={magicPending} style={{ border: "none" }}>
              {magicPending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        ) : (
          <form action={passwordAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label htmlFor="email2">Email</label>
              <input id="email2" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {passwordState && <p className="error">{passwordState}</p>}
            <button type="submit" className="cta" disabled={passwordPending} style={{ border: "none" }}>
              {passwordPending ? "…" : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
