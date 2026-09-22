"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInWithPassword, signUpWithPassword, sendMagicLink } from "./actions";

const MODES = [
  {
    key: "login" as const,
    label: "Log in",
    tag: "01",
    hint: "Already have an account. Sign in with your email and password.",
  },
  {
    key: "signup" as const,
    label: "Sign up",
    tag: "02",
    hint: "New here. Create an account with an email and password.",
  },
  {
    key: "magic" as const,
    label: "Magic link",
    tag: "03",
    hint: "No password needed. We'll email you a one-time link to sign in.",
  },
];

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "magic">("login");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    mode === "signup" ? signUpWithPassword : signInWithPassword,
    null
  );
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, null);
  const active = MODES.find((m) => m.key === mode)!;

  return (
    <div className="page">
      <header className="hero">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
        <p className="lede">{mode === "signup" ? "Start your hoshigo." : "Welcome back."}</p>
      </header>

      <section style={{ maxWidth: 420 }}>
        <div className="mode-tabs" role="tablist" aria-label="Sign-in method">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              className={`mode-tab${mode === m.key ? " active" : ""}`}
              onClick={() => setMode(m.key)}
            >
              <span className="mode-tab-tag">{m.tag}</span>
              {m.label}
            </button>
          ))}
        </div>
        <p className="mode-hint">
          <span className="dot" aria-hidden="true" />
          {active.hint}
        </p>

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
