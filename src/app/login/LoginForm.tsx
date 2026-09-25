"use client";

import { useState, useTransition } from "react";
import { signInWithPassword, signUpWithPassword, sendMagicLink, sendPasswordReset } from "./actions";
import HumanCheck from "@/components/HumanCheck";
import { NEEDS_HUMAN_CHECK } from "@/lib/human-check-shared";

export type Mode = "login" | "signup" | "magic" | "forgot";

const MODES = [
  { key: "login" as const, label: "Log in" },
  { key: "signup" as const, label: "Sign up" },
  { key: "magic" as const, label: "Magic link" },
];

const column = { display: "flex", flexDirection: "column", gap: 16 } as const;

// A field people never see; anything typed in it means a form filler.
function Honeypot() {
  return (
    <div className="hp-field" aria-hidden="true">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

// Each mode is its own server rendered <form> with stable names, so password
// managers recognise it before any script runs. Submits are handled here
// rather than through form actions, so nothing typed is ever reset: after the
// human check the same values are sent again, not an empty form.
export default function LoginForm({ initialMode, next }: { initialMode: Mode; next: string }) {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [check, setCheck] = useState<null | "signup" | "magic">(null);
  const [pending, startTransition] = useTransition();
  // what was last submitted, so a pass of the human check resends exactly that
  const [last, setLast] = useState({ email: "", password: "", website: "" });

  const setMode = (m: Mode) => {
    setModeState(m);
    setMessage(null);
    // keep the address bar honest, so reloads and password managers see the same page
    if (m === "login" || m === "signup") window.history.replaceState(null, "", m === "signup" ? "/login?mode=signup" : "/login");
  };

  const send = (which: Mode, human: string, v: { email: string; password: string; website: string }) => {
    const fd = new FormData();
    fd.set("email", v.email.trim());
    fd.set("password", v.password);
    fd.set("next", next);
    fd.set("human", human);
    fd.set("website", v.website);
    startTransition(async () => {
      let r: string | null | undefined;
      try {
        if (which === "login") r = await signInWithPassword(null, fd);
        else if (which === "signup") r = await signUpWithPassword(null, fd);
        else if (which === "magic") r = await sendMagicLink(null, fd);
        else r = await sendPasswordReset(null, fd);
      } catch (e) {
        // a redirect from the server action surfaces as a thrown navigation; let it through
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setMessage({ text: "We couldn't reach hoshigo just now. Check your connection and try again.", ok: false });
        return;
      }
      if (r === NEEDS_HUMAN_CHECK) {
        setCheck(which === "magic" ? "magic" : "signup");
        return;
      }
      if (r) setMessage({ text: r, ok: r.startsWith("Check") });
    });
  };

  const submit = (which: Mode) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    // read the form itself: password managers can fill it without firing React events
    const f = new FormData(e.currentTarget);
    const v = { email: String(f.get("email") ?? ""), password: String(f.get("password") ?? ""), website: String(f.get("website") ?? "") };
    setEmail(v.email);
    if (f.has("password")) setPassword(v.password);
    setLast(v);
    send(which, "", v);
  };

  const passed = (token: string) => {
    const which = check === "magic" ? "magic" : "signup";
    setCheck(null);
    send(which, token, last);
  };

  const status = message && <p className={message.ok ? "bio" : "error"} role={message.ok ? "status" : "alert"}>{message.text}</p>;

  return (
    <>
      {mode !== "forgot" && (
        <div className="mode-tabs" role="tablist" aria-label="Sign in method">
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

      {mode === "login" && (
        <form key="login" method="post" action="/login" onSubmit={submit("login")} style={column} aria-label="Log in">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {status}
          <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
            {pending ? "Logging in…" : "Log in"}
          </button>
          <button type="button" className="link-btn" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        </form>
      )}

      {mode === "signup" && (
        <form key="signup" method="post" action="/login?mode=signup" onSubmit={submit("signup")} style={column} aria-label="Sign up">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Honeypot />
          {status}
          <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
            {pending ? "One moment…" : "Create account"}
          </button>
        </form>
      )}

      {mode === "magic" && (
        <form key="magic" method="post" action="/login" onSubmit={submit("magic")} style={column} aria-label="Magic link">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Honeypot />
          {status}
          <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
            {pending ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      {mode === "forgot" && (
        <form key="forgot" method="post" action="/login" onSubmit={submit("forgot")} style={column} aria-label="Reset password">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {status}
          <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setMode("login")}>
            Back to login
          </button>
        </form>
      )}

      {check && <HumanCheck onDone={passed} onCancel={() => setCheck(null)} />}
    </>
  );
}
