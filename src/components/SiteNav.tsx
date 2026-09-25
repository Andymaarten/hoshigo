"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/[handle]/actions";
import { pendingRequestCount } from "@/app/friends/actions";
import { SOMEDAY } from "@/lib/someday";

export default function SiteNav({ loggedIn = false, handle }: { loggedIn?: boolean; handle?: string }) {
  const pathname = usePathname();
  const [requests, setRequests] = useState(0);
  // Server pages can take a moment; mark the tapped item right away so it's clear something happens.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const current = pending && pending.from === pathname ? pending.href : pathname;
  const go = (href: string) => () => setPending({ href, from: pathname });

  // fetched after paint so the badge never delays a page
  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    pendingRequestCount()
      .then((n) => live && setRequests(n))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [loggedIn, pathname]);

  return (
    <nav className="menu" aria-label="Main">
      {loggedIn && handle && (
        <Link href={`/${handle}`} aria-current={current === `/${handle}` ? "page" : undefined} onClick={go(`/${handle}`)}>
          <span>My hoshigo</span>
        </Link>
      )}
      {loggedIn && (
        <Link href={SOMEDAY.page} aria-current={current === SOMEDAY.page ? "page" : undefined} onClick={go(SOMEDAY.page)}>
          <span>{SOMEDAY.name}</span>
        </Link>
      )}
      {!loggedIn && (
        <>
          <Link href="/login" aria-current={current === "/login" ? "page" : undefined} onClick={go("/login")}>
            <span>Login</span>
          </Link>
          <Link href="/login?mode=signup" className="btn" style={{ minHeight: 36, padding: "0 14px" }}>
            Sign up
          </Link>
        </>
      )}
      {loggedIn && (
        <>
          <Link href="/friends" aria-current={current === "/friends" ? "page" : undefined} onClick={go("/friends")}>
            <span>Friends</span>
            {requests > 0 && (
              <span className="nav-badge" aria-label={`${requests} friend ${requests === 1 ? "request" : "requests"}`}>
                {requests}
              </span>
            )}
          </Link>
          <Link href="/explore" aria-current={current === "/explore" ? "page" : undefined} onClick={go("/explore")}>
            <span>Explore</span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="menu-link">
              <span>Log out</span>
            </button>
          </form>
        </>
      )}
    </nav>
  );
}
