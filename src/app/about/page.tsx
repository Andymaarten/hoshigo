import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export default function AboutPage() {
  return (
    <div className="page">
      <header className="hero">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          manifesto
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what we&apos;re about</h1>
      </header>

      <section className="prose">
        <div className="prose-item">
          <p className="prose-tag">01 — no scrolling</p>
          <p>
            <strong>Our goal is that you put your phone back down quickly.</strong> hoshigo isn&apos;t built to keep
            you scrolling — it&apos;s a place to note the handful of things you&apos;d give five stars, and then get
            on with your day.
          </p>
        </div>
        <div className="prose-item">
          <p className="prose-tag">02 — no attention economy</p>
          <p>
            We&apos;re not Facebook, Instagram or Snapchat. There are no ads here, and no algorithm that makes money
            the longer you stay. We&apos;re not optimizing for your attention.
          </p>
        </div>
        <div className="prose-item">
          <p className="prose-tag">03 — no AI slop</p>
          <p>AI agents can&apos;t make a profile on hoshigo — every page here belongs to a real person.</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
