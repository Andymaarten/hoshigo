import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="page">
      <header className="hero">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what we&apos;re about</h1>
      </header>

      <section className="prose">
        <p>
          <strong>Our goal is that you put your phone back down quickly.</strong> hoshigo isn&apos;t built to keep
          you scrolling — it&apos;s a place to note the handful of things you&apos;d give five stars, and then get on
          with your day.
        </p>
        <p>
          We&apos;re not Facebook, Instagram or Snapchat. There are no ads here, and no algorithm that makes money
          the longer you stay. We&apos;re not optimizing for your attention.
        </p>
        <p>
          No AI slop. AI agents can&apos;t make a profile on hoshigo — every page here belongs to a real person.
        </p>
      </section>

      <footer>
        <div className="inner">
          <p>Keep your own five-star page.</p>
          <Link href="/login" className="cta">
            Start your hoshigo
          </Link>
        </div>
      </footer>
    </div>
  );
}
