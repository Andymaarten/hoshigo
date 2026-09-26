"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import CoverImage from "@/components/CoverImage";
import type { BrowseQuery, BrowseRow } from "@/lib/picks-browse";
import { approveTip, browseTips } from "./actions";

type Result = { rows: BrowseRow[]; hasMore: boolean; total: number };

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Every public, visible listing, to choose tips from. All in place, no page reloads. */
export default function TipBrowser({ categories, initial }: { categories: { id: number; label: string }[]; initial: Result }) {
  const [query, setQuery] = useState<BrowseQuery>({ q: "", category: null, withNote: false, withCover: false, sort: "newest", page: 0 });
  const [text, setText] = useState("");
  const [result, setResult] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const catLabel = new Map(categories.map((c) => [c.id, c.label]));

  function run(next: Partial<BrowseQuery>) {
    // any change other than paging starts again on the first page
    const q = { ...query, ...next, page: "page" in next ? next.page! : 0 };
    setQuery(q);
    const mine = ++seq.current;
    start(async () => {
      const res = await browseTips(q);
      if (res && mine === seq.current) setResult(res);
    });
  }

  function toggle(row: BrowseRow, on: boolean) {
    start(async () => {
      const err = await approveTip(row.id, on);
      if (err) return setMsg(err);
      setMsg("");
      setResult((r) => ({ ...r, rows: r.rows.map((x) => (x.id === row.id ? { ...x, approved: on } : x)) }));
    });
  }

  return (
    <div className="stack">
      <form
        className="friend-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run({ q: text });
        }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="tip-q">Title, maker or page name</label>
          <input id="tip-q" type="search" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="off" spellCheck={false} />
        </div>
        <button type="submit" className="btn" disabled={pending}>
          Search
        </button>
      </form>

      <div className="chip-row" role="group" aria-label="Category">
        {[{ id: null as number | null, label: "all" }, ...categories].map((c) => (
          <button key={String(c.id)} type="button" className={`chip${query.category === c.id ? " active" : ""}`} aria-pressed={query.category === c.id} onClick={() => run({ category: c.id })}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="feedback-controls">
        <label className="check-row" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={query.withNote} onChange={(e) => run({ withNote: e.target.checked })} />
          Has a note
        </label>
        <label className="check-row" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={query.withCover} onChange={(e) => run({ withCover: e.target.checked })} />
          Has a cover
        </label>
        <select aria-label="Sort" value={query.sort} onChange={(e) => run({ sort: e.target.value as BrowseQuery["sort"] })}>
          <option value="newest">newest</option>
          <option value="kept">most kept</option>
        </select>
        <span className="hint" aria-live="polite">
          {pending ? "Looking…" : `${result.total} listings`}
        </span>
      </div>
      {msg && <p className="hint">{msg}</p>}

      <ul className="feed-list" aria-busy={pending}>
        {result.rows.map((c) => (
          <li key={c.id} className="feed-row someday-row">
            <div className="thumb" aria-hidden="true">
              <CoverImage src={c.imageUrl} small />
            </div>
            <div className="feed-txt">
              <span className="title">{c.title}</span>
              {c.by && <span className="by">{c.by}</span>}
              <span className="someday-meta">
                <Link href={`/${c.handle}/${c.id}`}>@{c.handle}</Link> · {catLabel.get(c.categoryId) ?? ""} · {formatDate(c.createdAt)}
                {c.kept > 1 ? ` · kept by ${c.kept}` : ""}
                {c.matched ? "" : " · by hand"}
              </span>
              {c.note && <p className="someday-note">{c.note.slice(0, 200)}</p>}
            </div>
            <div className="someday-actions">
              <label className="check-row" style={{ fontSize: 14 }}>
                <input type="checkbox" checked={c.approved} disabled={pending} onChange={(e) => toggle(c, e.target.checked)} />
                Approve for tips
              </label>
            </div>
          </li>
        ))}
      </ul>
      {result.rows.length === 0 && <p className="bio">Nothing matches.</p>}

      <div className="sheet-row">
        <button type="button" className="btn btn-small" disabled={pending || query.page === 0} onClick={() => run({ page: query.page - 1 })}>
          Newer
        </button>
        <button type="button" className="btn btn-small" disabled={pending || !result.hasMore} onClick={() => run({ page: query.page + 1 })}>
          Older
        </button>
      </div>
    </div>
  );
}
