import Link from "next/link";

export default function SiteFooter({ loggedIn = false }: { loggedIn?: boolean }) {
  return (
    <footer>
      <div className="inner">
        <div className="footer-tag" lang="ja">
          星五
        </div>
        {!loggedIn && (
          <div className="footer-msg">
            <p>Keep your own five star page.</p>
            <Link href="/login" className="cta">
              Sign up / Login
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}
