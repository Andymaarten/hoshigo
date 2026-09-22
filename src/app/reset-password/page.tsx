"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") || "");
    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </div>
        <p className="lede">Set a new password.</p>
      </header>
      <main className="auth-main">
        <section style={{ maxWidth: 420 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
              {pending ? "…" : "Save password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
