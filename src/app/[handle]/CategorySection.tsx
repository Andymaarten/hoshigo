"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Category, Item } from "@/lib/supabase/types";
import { deleteItem, updateNote } from "./actions";
import LockIcon from "@/components/icons/LockIcon";
import EditItem from "./EditItem";
import Sheet from "@/components/Sheet";
import CoverImage from "@/components/CoverImage";
import { imageSrc } from "@/lib/image-src";
import { displayUrl } from "@/lib/link-input";
import { SHAPE } from "@/lib/category-display";

// The first page shows 5 items. Every page after that gives up one grid slot
// to a "previous" tile (instead of a separate button above the grid, which
// pushed the whole grid down a row whenever it appeared/disappeared) so it
// only ever shows 4 new items — a deliberate trade-off for a grid that never
// reflows when you page back and forth.
const FIRST_PAGE_SIZE = 5;
const NEXT_PAGE_SIZE = 4;


function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

// Defense in depth: addItem already rejects non-http(s) links before they're saved, but this
// guards any row that predates that check so a "javascript:" URL can never end up in an href.
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function Thumb({ item, shape, big }: { item: Item; shape?: "tall" | "photo"; big?: boolean }) {
  return (
    <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}${big ? " big" : ""}`}>
      {item.year && <span>{item.year}</span>}
      <CoverImage src={item.image_url} eager={big} />
    </div>
  );
}

export default function CategorySection({
  category,
  items,
  handle,
  isOwner,
  allCategories,
}: {
  category: Category;
  items: Item[];
  handle: string;
  isOwner: boolean;
  allCategories: Category[];
}) {
  const shape = SHAPE[category.slug];
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);

  const pageSize = page === 0 ? FIRST_PAGE_SIZE : NEXT_PAGE_SIZE;
  const pageStart = page === 0 ? 0 : FIRST_PAGE_SIZE + (page - 1) * NEXT_PAGE_SIZE;
  const visibleItems = items.slice(pageStart, pageStart + pageSize);
  const hasPrevPage = page > 0;
  const hasNextPage = pageStart + pageSize < items.length;
  // TODO: replace with real friends/subscription check once that backend exists —
  // for now every non-owner viewer is treated as "not a friend, not a paying customer"
  // and gets a locked tile instead of a working "next" past the first page.
  const showPrevTile = isOwner && hasPrevPage;
  const showNextTile = isOwner && hasNextPage;
  const showLockTile = !isOwner && hasNextPage;
  const gridId = `grid-${category.slug}`;

  // The grid should always occupy the same number of cells (FIRST_PAGE_SIZE) so
  // paging back and forth never changes the section's height or row count — a
  // later page with fewer real items gets invisible placeholder cells instead.
  const filledSlots = (showPrevTile ? 1 : 0) + visibleItems.length + (showNextTile || showLockTile ? 1 : 0);
  const placeholderCount = Math.max(0, FIRST_PAGE_SIZE - filledSlots);
  // The prev/next/lock tiles reuse .thumb's box, so they need the same shape modifier as real
  // items in this category or they render as a plain square instead of matching aspect ratio
  // (e.g. books/films/tv are taller than wide).
  const navThumbClass = `thumb nav-thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}`;

  // Prefetch the next page's cover images so "next" never has a loading delay —
  // only relevant while pagination actually still works (i.e. for the owner).
  useEffect(() => {
    if (!isOwner || !hasNextPage) return;
    const nextStart = pageStart + pageSize;
    const nextItems = items.slice(nextStart, nextStart + NEXT_PAGE_SIZE);
    nextItems.forEach((item) => {
      if (!item.image_url) return;
      const src = imageSrc(item.image_url);
      if (!src) return;
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = src;
    });
  }, [isOwner, hasNextPage, pageStart, pageSize, items]);

  function open(item: Item) {
    setActive(item);
    setNote(item.note ?? "");
    setNoteEditing(!item.note);
    setEditing(false);
    setSheetOpen(true);
  }

  return (
    <section aria-labelledby={`h-${category.slug}`}>
      <h2 id={`h-${category.slug}`}>{category.label}</h2>

      <ul className="grid" id={gridId}>
        {showPrevTile && (
          <li>
            <button
              type="button"
              className="item nav-tile"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label={`Show previous ${pageStart} items`}
            >
              <div className={navThumbClass} aria-hidden="true">
                ←
              </div>
              <div className="txt">
                <span className="title">Previous</span>
                <span className="by">{pageStart} more</span>
              </div>
            </button>
          </li>
        )}

        {visibleItems.map((item) => (
          <li key={item.id}>
            <button type="button" className="item" onClick={() => open(item)}>
              <Thumb item={item} shape={shape} />
              <div className="txt">
                <span className="title">{item.title}</span>
                <span className="by">{item.by}</span>
                <span className="date">{formatDate(item.created_at)}</span>
              </div>
            </button>
          </li>
        ))}

        {showNextTile && (
          <li>
            <button
              type="button"
              className="item nav-tile"
              onClick={() => setPage((p) => p + 1)}
              aria-label={`Show next ${Math.min(NEXT_PAGE_SIZE, items.length - pageStart - pageSize)} items`}
            >
              <div className={navThumbClass} aria-hidden="true">
                →
              </div>
              <div className="txt">
                <span className="title">Next</span>
                <span className="by">{items.length - pageStart - pageSize} more</span>
              </div>
            </button>
          </li>
        )}

        {showLockTile && (
          <li>
            <Link href="/pricing" className="item nav-tile locked">
              <div className={navThumbClass} aria-hidden="true">
                <LockIcon />
              </div>
              <div className="txt">
                <span className="title">See more</span>
                <span className="by">hoshigo+</span>
              </div>
            </Link>
          </li>
        )}

        {Array.from({ length: placeholderCount }).map((_, i) => (
          <li key={`placeholder-${i}`} aria-hidden="true" className="item grid-placeholder">
            <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}`} />
            <div className="txt">
              <span className="title">&nbsp;</span>
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} labelledBy={`sheet-title-${category.slug}`}>
          {active && editing && (
            <EditItem
              handle={handle}
              item={active}
              categories={allCategories}
              onCancel={() => setEditing(false)}
              onDone={() => {
                setEditing(false);
                setSheetOpen(false);
              }}
            />
          )}

          {active && !editing && (
            <>
              <Thumb item={active} shape={shape} big />
              <h3 id={`sheet-title-${category.slug}`}>{active.title}</h3>
              <div className="meta">{[active.by, active.year].filter(Boolean).join(", ")}</div>

              {isOwner ? (
                <>
                  {noteEditing ? (
                    <>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="No note yet."
                        style={{
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          fontSize: 16,
                          border: "1px solid var(--rule)",
                          background: "transparent",
                          padding: 10,
                          minHeight: 70,
                        }}
                      />
                      <button
                        type="button"
                        className="btn"
                        disabled={saving}
                        style={{ alignSelf: "flex-start" }}
                        onClick={async () => {
                          setSaving(true);
                          await updateNote(handle, active.id, note);
                          // Keep the open item in sync so a following Edit doesn't write back the old note.
                          setActive((a) => (a ? { ...a, note: note || null } : a));
                          setSaving(false);
                          setNoteEditing(false);
                        }}
                      >
                        {saving ? "Saving…" : "Save note"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={`note${note ? "" : " empty"}`}>{note || "No note yet."}</p>
                      <button
                        type="button"
                        className="btn"
                        style={{ alignSelf: "flex-start" }}
                        onClick={() => setNoteEditing(true)}
                      >
                        Edit note
                      </button>
                    </>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="btn" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        deleteItem(handle, active.id);
                        setSheetOpen(false);
                      }}
                      style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <p className={`note${active.note ? "" : " empty"}`}>{active.note || "No note yet."}</p>
              )}

              {safeHttpUrl(active.url) && (
                <div className="link-out">
                  <a href={safeHttpUrl(active.url)!} target="_blank" rel="noopener" className="btn">
                    Open {active.source_label || "link"} ↗
                  </a>
                  <span className="link-dest">{displayUrl(active.url!)}</span>
                </div>
              )}
            </>
          )}
      </Sheet>
    </section>
  );
}
