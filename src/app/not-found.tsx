import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Link href="/" className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </Link>
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
