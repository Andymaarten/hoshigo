import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer>
      <div className="inner">
        <div className="copy">
          <div className="label">
            <span className="dot" aria-hidden="true" />
            hoshigo
          </div>
          <p>Keep your own five-star page.</p>
        </div>
        <Link href="/login" className="cta">
          Start / Login
        </Link>
      </div>
    </footer>
  );
}
