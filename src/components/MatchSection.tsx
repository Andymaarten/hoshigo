"use client";

import { useState } from "react";
import MatchRow from "./MatchRow";

export interface Match {
  handle: string;
  displayName: string;
  matchPercent: number;
  bio?: string;
}

const PAGE_SIZE = 5;

export default function MatchSection({
  categorySlug,
  categoryLabel,
  matches,
}: {
  categorySlug: string;
  categoryLabel: string;
  matches: Match[];
}) {
  const [page, setPage] = useState(0);
  const start = page * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = start + PAGE_SIZE < matches.length;

  return (
    <section aria-labelledby={`explore-${categorySlug}`}>
      <h2 id={`explore-${categorySlug}`}>{categoryLabel}</h2>
      <ul className="match-list">
        {visible.map((m) => (
          <MatchRow key={m.handle} handle={m.handle} displayName={m.displayName} matchPercent={m.matchPercent} bio={m.bio} />
        ))}
      </ul>
      {(hasPrev || hasNext) && (
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {hasPrev && (
            <button type="button" className="btn" onClick={() => setPage((p) => p - 1)}>
              ‹ Previous
            </button>
          )}
          {hasNext && (
            <button type="button" className="btn" onClick={() => setPage((p) => p + 1)}>
              Next ›
            </button>
          )}
        </div>
      )}
    </section>
  );
}
