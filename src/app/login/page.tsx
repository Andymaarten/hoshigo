"use client";

import { Suspense, useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPassword, signUpWithPassword, sendMagicLink, sendPasswordReset } from "./actions";
import SiteNav from "@/components/SiteNav";
import Wordmark from "@/components/Wordmark";
import HumanCheck from "@/components/HumanCheck";
import { NEEDS_HUMAN_CHECK } from "@/lib/human-check-shared";

// Hidden fields every signup form carries: the human check token and a honeypot.
function GuardFields() {
  return (
    <>
      <input type="hidden" name="human" defaultValue="" />
      <div className="hp-field" aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}

const MODES = [
  { key: "login" as const, label: "Log in" },
  { key: "signup" as const, label: "Sign up" },
  { key: "magic" as const, label: "Magic link" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "magic" | "forgot">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [check, setCheck] = useState<null | "password" | "magic">(null);
  const passwordForm = useRef<HTMLFormElement>(null);
  const magicForm = useRef<HTMLFormElement>(null);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    mode === "signup"
      ? async (prev: string | null, fd: FormData) => {
          const r = await signUpWithPassword(prev, fd);
          if (r === NEEDS_HUMAN_CHECK) setCheck("password");
          return r;
        }
      : signInWithPassword,
    null
  );
  const [magicState, magicAction, magicPending] = useActionState(async (prev: string | null, fd: FormData) => {
    const r = await sendMagicLink(prev, fd);
    if (r === NEEDS_HUMAN_CHECK) setCheck("magic");
    return r;
  }, null);

  const passed = (token: string) => {
    const form = check === "magic" ? magicForm.current : passwordForm.current;
    setCheck(null);
    if (!form) return;
    (form.elements.namedItem("human") as HTMLInputElement).value = token;
    form.requestSubmit();
  };

  // Sign up asks for the check before the first submit; magic links only when
  // the server says the address is new.
  const beforeSignup = (e: React.FormEvent<HTMLFormElement>) => {
    if (mode !== "signup") return;
    if ((e.currentTarget.elements.namedItem("human") as HTMLInputElement).value) return;
    e.preventDefault();
    setCheck("password");
  };
  const [resetState, resetAction, resetPending] = useActionState(sendPasswordReset, null);

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark />
          <SiteNav />
        </div>
        <p className="lede">{mode === "signup" ? "Start your hoshigo." : "Welcome back."}</p>
        {searchParams.get("invite") && (
          <p className="bio">You were invited to be friends. Sign up or log in and you&apos;ll be friends straight away.</p>
        )}
      </header>

      <main className="auth-main">
        <section style={{ maxWidth: 420 }}>
          {mode !== "forgot" && (
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
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {mode === "forgot" ? (
            <form action={resetAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label htmlFor="email3">Email</label>
                <input id="email3" name="email" type="email" required autoComplete="email" />
              </div>
              {resetState && <p className={resetState.startsWith("Check") ? "bio" : "error"}>{resetState}</p>}
              <button type="submit" className="cta" disabled={resetPending} style={{ border: "none" }}>
                {resetPending ? "Sending…" : "Send reset link"}
              </button>
              <button
                type="button"
                className="btn"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setMode("login")}
              >
                Back to login
              </button>
            </form>
          ) : mode === "magic" ? (
            <form ref={magicForm} action={magicAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <GuardFields />
              {magicState && magicState !== NEEDS_HUMAN_CHECK && (
                <p className={magicState.startsWith("Check") ? "bio" : "error"}>{magicState}</p>
              )}
              <button type="submit" className="cta" disabled={magicPending} style={{ border: "none" }}>
                {magicPending ? "Sending…" : "Send magic link"}
              </button>
            </form>
          ) : (
            <form ref={passwordForm} action={passwordAction} onSubmit={beforeSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
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
              {mode === "signup" && <GuardFields />}
              {passwordState && passwordState !== NEEDS_HUMAN_CHECK && <p className="error">{passwordState}</p>}
              <button type="submit" className="cta" disabled={passwordPending} style={{ border: "none" }}>
                {passwordPending ? "…" : mode === "signup" ? "Create account" : "Log in"}
              </button>
              {mode === "login" && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setMode("forgot")}
                >
                  Forgot password?
                </button>
              )}
            </form>
          )}
        </section>
      </main>
      {check && <HumanCheck onDone={passed} onCancel={() => setCheck(null)} />}
    </div>
  );
}
