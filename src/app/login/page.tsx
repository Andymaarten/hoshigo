import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import Wordmark from "@/components/Wordmark";
import LoginForm, { type Mode } from "./LoginForm";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return { title: sp.mode === "signup" ? "Sign up · hoshigo" : "Log in · hoshigo" };
}

// Server rendered, so the forms are in the HTML before any script runs.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const mode: Mode = sp.mode === "signup" ? "signup" : sp.mode === "magic" ? "magic" : "login";

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark />
          <SiteNav />
        </div>
        <p className="lede">{mode === "signup" ? "Start your hoshigo." : "Welcome back."}</p>
        {one(sp.invite) && (
          <p className="bio">You were invited to be friends. Sign up or log in and you&apos;ll be friends straight away.</p>
        )}
      </header>

      <main className="auth-main">
        <section style={{ maxWidth: 420 }}>
          <LoginForm key={mode} initialMode={mode} next={one(sp.next)} />
        </section>
      </main>
    </div>
  );
}
