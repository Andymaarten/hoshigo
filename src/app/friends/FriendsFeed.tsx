"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Category } from "@/lib/supabase/types";
import type { FeedItem, FeedPage } from "@/lib/friends-feed";
import { SHAPE } from "@/lib/category-display";
import CoverImage from "@/components/CoverImage";
import Sheet from "@/components/Sheet";
import ListingSheetBody from "@/components/ListingSheet";
import { loadOlderFeed } from "./actions";

export type FeedFriend = { handle: string; name: string; isPrivate: boolean };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function FriendsFeed({
  categories,
  initial,
  friends,
  initialSlug,
}: {
  categories: Category[];
  /** "all" plus one entry per category slug */
  initial: Record<string, FeedPage>;
  friends: Record<string, FeedFriend>;
  initialSlug: string;
}) {
  const [pages, setPages] = useState(initial);
  const [slug, setSlug] = useState(initial[initialSlug] ? initialSlug : "all");
  const [active, setActive] = useState<FeedItem | null>(null);
  const [loading, startLoading] = useTransition();

  const catById = new Map(categories.map((c) => [c.id, c]));
  const activeCat = categories.find((c) => c.slug === slug);
  const page = pages[slug] ?? { items: [], hasOlder: false };

  function choose(next: string) {
    setSlug(next);
    try {
      const url = new URL(window.location.href);
      if (next === "all") url.searchParams.delete("cat");
      else url.searchParams.set("cat", next);
      window.history.replaceState(window.history.state, "", url);
    } catch {}
  }

  function older() {
    const last = page.items[page.items.length - 1];
    if (!last) return;
    const key = slug;
    startLoading(async () => {
      const more = await loadOlderFeed(activeCat?.id ?? null, last.created_at, last.id);
      setPages((p) => {
        const cur = p[key];
        const seen = new Set(cur.items.map((i) => i.id));
        return { ...p, [key]: { items: [...cur.items, ...more.items.filter((i) => !seen.has(i.id))], hasOlder: more.hasOlder } };
      });
    });
  }

  const activeFriend = active ? friends[active.profile_id] : undefined;
  const activeShape = active ? SHAPE[catById.get(active.category_id)?.slug ?? ""] : undefined;

  return (
    <>
      <div className="chip-row" role="group" aria-label="Filter by category" style={{ marginBottom: 18 }}>
        {[{ slug: "all", label: "all" }, ...categories].map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`chip${slug === c.slug ? " active" : ""}`}
            aria-pressed={slug === c.slug}
            onClick={() => choose(c.slug)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {page.items.length === 0 ? (
        <p className="bio">No {activeCat ? activeCat.label : "additions"} from friends yet.</p>
      ) : (
        <ul className="feed-list">
          {page.items.map((item) => {
            const friend = friends[item.profile_id];
            const cat = catById.get(item.category_id);
            const shape = cat ? SHAPE[cat.slug] : undefined;
            return (
              <li key={item.id} className="feed-row">
                <button
                  type="button"
                  className={`feed-cover thumb${shape === "tall" ? " tall" : ""}`}
                  onClick={() => setActive(item)}
                  aria-label={`Open ${item.title}`}
                >
                  <CoverImage src={item.image_url} small />
                </button>
                <div className="feed-txt">
                  <button type="button" className="title feed-title" onClick={() => setActive(item)}>
                    {item.title}
                  </button>
                  {item.by && <span className="by">{item.by}</span>}
                  <span className="feed-meta">
                    {friend && (
                      <Link href={`/${friend.handle}`} className="feed-friend">
                        {friend.name}
                      </Link>
                    )}
                    {cat && <span>{cat.label}</span>}
                    <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {page.hasOlder && (
        <button type="button" className="btn load-more" disabled={loading} onClick={older}>
          {loading ? "Loading…" : "Older"}
        </button>
      )}

      <Sheet open={!!active} onClose={() => setActive(null)} labelledBy="feed-sheet-title">
        {active && activeFriend && (
          <>
            <p className="meta">
              From <Link href={`/${activeFriend.handle}`}>{activeFriend.name}</Link>
            </p>
            <ListingSheetBody
              item={active}
              shape={activeShape}
              titleId="feed-sheet-title"
              handle={activeFriend.handle}
              mine={false}
              shareable={active.shareable}
              friendsOnly={activeFriend.isPrivate}
              canAdd
              onAdd={() => setActive(null)}
            />
          </>
        )}
      </Sheet>
    </>
  );
}
