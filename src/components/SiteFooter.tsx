import Link from "next/link";

export default function SiteFooter({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <footer>
      <div className="inner">
        <div className="footer-brand">
          <span className="footer-word">hoshigo</span>
          <span className="footer-ja-tag" lang="ja">
            星五
          </span>
        </div>
        {!loggedIn && (
          <div className="copy">
            <p>Keep your own five-star page.</p>
            <Link href="/login" className="cta">
              Start / Login
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}
