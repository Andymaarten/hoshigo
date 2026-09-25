"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Category, Item } from "@/lib/supabase/types";
import Sheet from "@/components/Sheet";
import ListingSheetBody from "@/components/ListingSheet";
import { SHAPE } from "@/lib/category-display";
import CoverImage from "@/components/CoverImage";
import { ADDED_EVENT, ADD_PREFILL_EVENT, type AddPrefill } from "@/lib/item-order";
import { SOMEDAY } from "@/lib/someday";
import { resolveSomeday } from "./actions";

export type SomedayRow = {
  id: string;
  source_item_id: string | null;
  work_id: string | null;
  category_id: number;
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
  url: string | null;
  created_at: string;
  from: { name: string; handle: string; href: string } | null;
  /** the original listing while it exists and you may see it */
  source: Item | null;
  alsoFor: { handle: string; name: string }[];
};

function formatDate(s: string) {
  const d = new Date(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}

function safeUrl(u: string | null) {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export default function SomedayList({ rows: initial, categories, mine }: { rows: SomedayRow[]; categories: Category[]; mine: boolean }) {
  const [rows, setRows] = useState(initial);
  const [slug, setSlug] = useState("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  // the row whose actions are unfolded by its small mark
  const [unfolded, setUnfolded] = useState<string | null>(null);

  // a tap anywhere outside that row folds them away again
  useEffect(() => {
    if (!unfolded) return;
    function onDown(e: PointerEvent) {
      if (!(e.target as Element)?.closest?.(`[data-row="${unfolded}"]`)) {
        setUnfolded(null);
        setConfirming(null);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [unfolded]);
  const [open, setOpen] = useState<SomedayRow | null>(null);
  const [pending, start] = useTransition();
  const catById = new Map(categories.map((c) => [c.id, c]));

  // "Loved it" went through the add dialog and was added: it leaves this list
  useEffect(() => {
    function onAdded(e: Event) {
      const id = (e as CustomEvent<{ somedayId?: string }>).detail?.somedayId;
      if (!id) return;
      setRows((rs) => rs.filter((r) => r.id !== id));
      resolveSomeday(id, "loved").catch(() => {});
    }
    window.addEventListener(ADDED_EVENT, onAdded);
    return () => window.removeEventListener(ADDED_EVENT, onAdded);
  }, []);

  const present = new Set(rows.map((r) => r.category_id));
  const chips = categories.filter((c) => present.has(c.id));
  const active = chips.find((c) => c.slug === slug);
  const visible = active ? rows.filter((r) => r.category_id === active.id) : rows;

  if (!rows.length) return <p className="bio">{mine ? SOMEDAY.empty : "Nothing here yet."}</p>;

  function lovedIt(r: SomedayRow) {
    const detail: AddPrefill = {
      somedayId: r.id,
      categoryId: r.category_id,
      workId: r.work_id,
      title: r.title,
      by: r.by,
      year: r.year,
      url: safeUrl(r.url),
      sourceLabel: null,
      imageUrl: r.image_url,
    };
    window.dispatchEvent(new CustomEvent(ADD_PREFILL_EVENT, { detail }));
  }

  return (
    <div>
      {chips.length > 1 && (
        <div className="chip-row" role="group" aria-label="Filter by category" style={{ marginBottom: 18 }}>
          {[{ slug: "all", label: "all" }, ...chips].map((c) => (
            <button key={c.slug} type="button" className={`chip${slug === c.slug ? " active" : ""}`} aria-pressed={slug === c.slug} onClick={() => setSlug(c.slug)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <ul className="feed-list">
        {visible.map((r) => {
          const cat = catById.get(r.category_id);
          const shape = cat ? SHAPE[cat.slug] : undefined;
          return (
            <li key={r.id} className="feed-row someday-row" data-row={r.id}>
              {mine && (
                <button
                  type="button"
                  className="someday-mark"
                  aria-label={SOMEDAY.doneWith}
                  aria-expanded={unfolded === r.id}
                  onClick={() => {
                    setConfirming(null);
                    setUnfolded((u) => (u === r.id ? null : r.id));
                  }}
                >
                  ×
                </button>
              )}
              <button type="button" className={`feed-cover thumb${shape === "tall" ? " tall" : ""}`} onClick={() => setOpen(r)} aria-label={`Open ${r.title}`}>
                <CoverImage src={r.image_url} small />
              </button>
              <div className="feed-txt">
                <button type="button" className="title feed-title" onClick={() => setOpen(r)}>
                  {r.title}
                </button>
                {r.by && <span className="by">{r.by}</span>}
                <span className="someday-meta">
                  {[
                    cat ? <span key="c">{cat.label}</span> : null,
                    r.from ? (
                      <span key="f">
                        {SOMEDAY.fromWord} <Link href={r.from.href} className="feed-friend">{r.from.name}</Link>
                      </span>
                    ) : null,
                    <time key="d" dateTime={r.created_at}>{SOMEDAY.savedOn(formatDate(r.created_at))}</time>,
                  ]
                    .filter(Boolean)
                    .map((el, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span aria-hidden="true"> · </span>}
                        {el}
                      </Fragment>
                    ))}
                </span>
                {r.alsoFor.length > 0 && (
                  <span className="feed-meta">
                    <span>
                      {SOMEDAY.alsoFor}:{" "}
                      {r.alsoFor.map((f, i) => (
                        <Fragment key={f.handle}>
                          {i > 0 && ", "}
                          <Link href={`/${f.handle}`} className="feed-friend">{f.name}</Link>
                        </Fragment>
                      ))}
                    </span>
                  </span>
                )}
              </div>
                {mine && unfolded === r.id && (
                  <div className="someday-actions">
                    {confirming === r.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              if (await resolveSomeday(r.id, "not_for_me")) setRows((rs) => rs.filter((x) => x.id !== r.id));
                              setConfirming(null);
                            })
                          }
                        >
                          {SOMEDAY.confirmRemove}
                        </button>
                        <button type="button" className="btn btn-small btn-quiet" onClick={() => setConfirming(null)}>
                          {SOMEDAY.keep}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-small btn-on" onClick={() => lovedIt(r)}>
                          {SOMEDAY.lovedIt}
                        </button>
                        <button type="button" className="btn btn-small btn-quiet" onClick={() => setConfirming(r.id)}>
                          {SOMEDAY.notOne}
                        </button>
                      </>
                    )}
                  </div>
                )}
            </li>
          );
        })}
      </ul>

      <Sheet open={!!open} onClose={() => setOpen(null)} labelledBy="someday-sheet-title">
        {open && (
          <>
            {open.from && (
              <p className="meta">
                {SOMEDAY.fromWord} <Link href={`/${open.from.handle}`}>{open.from.name}</Link>
              </p>
            )}
            <ListingSheetBody
              item={open.source ?? snapshotItem(open)}
              shape={SHAPE[catById.get(open.category_id)?.slug ?? ""]}
              titleId="someday-sheet-title"
              handle={open.from?.handle ?? ""}
              mine={false}
              shareable={false}
              friendsOnly={false}
            />
          </>
        )}
      </Sheet>
    </div>
  );
}

// The original is gone or hidden: show what was saved.
function snapshotItem(r: SomedayRow): Item {
  return {
    id: r.id,
    profile_id: "",
    category_id: r.category_id,
    work_id: r.work_id,
    title: r.title,
    by: r.by,
    year: r.year,
    url: r.url,
    image_url: r.image_url,
    note: null,
    featured: false,
    source_label: null,
    position: 0,
    created_at: r.created_at,
  };
}
