import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import Wordmark from "@/components/Wordmark";

export default function NotFound() {
  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark />
        </div>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          not found
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>nothing here.</h1>
        <p className="bio">This page doesn&apos;t exist, or the link has changed.</p>
        <p style={{ marginTop: 24 }}>
          <Link href="/" className="btn">
            Go to hoshigo
          </Link>
        </p>
      </header>
      <SiteFooter />
    </div>
  );
}
