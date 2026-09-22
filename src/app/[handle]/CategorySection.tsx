"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category, Item } from "@/lib/supabase/types";
import { deleteItem, updateNote } from "./actions";
import LockIcon from "@/components/icons/LockIcon";

// The first page shows 5 items. Every page after that gives up one grid slot
// to a "previous" tile (instead of a separate button above the grid, which
// pushed the whole grid down a row whenever it appeared/disappeared) so it
// only ever shows 4 new items — a deliberate trade-off for a grid that never
// reflows when you page back and forth.
const FIRST_PAGE_SIZE = 5;
const NEXT_PAGE_SIZE = 4;

const SHAPE: Record<string, "tall" | "photo" | undefined> = {
  films: "tall",
  books: "tall",
  tv: "tall",
  things: "photo",
  games: "photo",
  podcasts: "photo",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function Thumb({ item, shape, big }: { item: Item; shape?: "tall" | "photo"; big?: boolean }) {
  return (
    <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}${big ? " big" : ""}`}>
      {item.year && <span>{item.year}</span>}
      {item.image_url && <img src={item.image_url} alt="" />}
    </div>
  );
}

export default function CategorySection({
  category,
  items,
  handle,
  isOwner,
}: {
  category: Category;
  items: Item[];
  handle: string;
  isOwner: boolean;
}) {
  const shape = SHAPE[category.slug];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

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

  // Prefetch the next page's cover images so "next" never has a loading delay —
  // only relevant while pagination actually still works (i.e. for the owner).
  useEffect(() => {
    if (!isOwner || !hasNextPage) return;
    const nextStart = pageStart + pageSize;
    const nextItems = items.slice(nextStart, nextStart + NEXT_PAGE_SIZE);
    nextItems.forEach((item) => {
      if (!item.image_url) return;
      const img = new Image();
      img.src = item.image_url;
    });
  }, [isOwner, hasNextPage, pageStart, pageSize, items]);

  function open(item: Item) {
    setActive(item);
    setNote(item.note ?? "");
    dialogRef.current?.showModal();
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
              aria-label="Show previous items"
            >
              <div className="thumb nav-thumb" aria-hidden="true">
                ←
              </div>
              <div className="txt">
                <span className="title">Previous</span>
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
              <div className="thumb nav-thumb" aria-hidden="true">
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
              <div className="thumb nav-thumb" aria-hidden="true">
                <LockIcon />
              </div>
              <div className="txt">
                <span className="title">See more</span>
                <span className="by">hoshigo+</span>
              </div>
            </Link>
          </li>
        )}
      </ul>

      <dialog ref={dialogRef} className="sheet" aria-labelledby={`sheet-title-${category.slug}`}>
        <div className="sheet-in">
          <button type="button" className="close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
            ×
          </button>
          {active && (
            <>
              <Thumb item={active} shape={shape} big />
              <h3 id={`sheet-title-${category.slug}`}>{active.title}</h3>
              <div className="meta">{[active.by, active.year].filter(Boolean).join(", ")}</div>

              {isOwner ? (
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
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        await updateNote(handle, active.id, note);
                        setSaving(false);
                      }}
                    >
                      {saving ? "Saving…" : "Save note"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        deleteItem(handle, active.id);
                        dialogRef.current?.close();
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

              {active.url && (
                <a href={active.url} target="_blank" rel="noopener" className="btn" style={{ alignSelf: "flex-start" }}>
                  Open {active.source_label || "link"}
                </a>
              )}
            </>
          )}
        </div>
      </dialog>
    </section>
  );
}
