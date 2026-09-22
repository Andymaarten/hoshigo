"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/[handle]/actions";

export default function SiteNav({ loggedIn = false, handle }: { loggedIn?: boolean; handle?: string }) {
  const pathname = usePathname();

  return (
    <nav className="menu" aria-label="Main">
      {loggedIn && handle && (
        <Link href={`/${handle}`} aria-current={pathname === `/${handle}` ? "page" : undefined}>
          <span>My hoshigo</span>
        </Link>
      )}
      {loggedIn ? (
        <form action={signOut}>
          <button type="submit" className="menu-link">
            <span>Log out</span>
          </button>
        </form>
      ) : (
        <>
          <Link href="/login" aria-current={pathname === "/login" ? "page" : undefined}>
            <span>Login</span>
          </Link>
          <Link href="/login?mode=signup" className="btn" style={{ minHeight: 36, padding: "0 14px" }}>
            Sign up
          </Link>
        </>
      )}
      <Link href="/friends" aria-current={pathname === "/friends" ? "page" : undefined}>
        <span>Friends</span>
      </Link>
      <Link href="/explore" aria-current={pathname === "/explore" ? "page" : undefined}>
        <span>Explore</span>
      </Link>
    </nav>
  );
}
