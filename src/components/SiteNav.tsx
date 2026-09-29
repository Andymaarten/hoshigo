"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/[handle]/actions";
import { navFlags } from "@/app/friends/actions";
import { newsFresh } from "@/app/news/actions";
import { NEWS } from "@/lib/news-copy";
import { SOMEDAY } from "@/lib/someday";

export default function SiteNav({ loggedIn = false, handle }: { loggedIn?: boolean; handle?: string }) {
  const pathname = usePathname();
  const [requests, setRequests] = useState(0);
  const [fresh, setFresh] = useState(false);
  const [news, setNews] = useState(false);
  // Server pages can take a moment; mark the tapped item right away so it's clear something happens.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const current = pending && pending.from === pathname ? pending.href : pathname;
  const go = (href: string) => () => setPending({ href, from: pathname });

  // fetched after paint so the badge never delays a page
  useEffect(() => {
    if (!loggedIn) return;
    let live = true;
    newsFresh()
      .then((n) => live && setNews(n))
      .catch(() => {});
    navFlags()
      .then((f) => {
        if (!live) return;
        setRequests(f.requests);
        setFresh(f.fresh);
      })
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
            {requests === 0 && fresh && current !== "/friends" && <span className="nav-dot" aria-label="new from friends" />}
          </Link>
          <Link href="/news" aria-current={current === "/news" ? "page" : undefined} onClick={go("/news")}>
            <span>{NEWS.nav}</span>
            {news && current !== "/news" && <span className="nav-dot" aria-label="something new" />}
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
