"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { FoundPerson } from "@/lib/people-search";
import { findPeople } from "./actions";

/** Search in place: no page reload, so you stay here instead of jumping back to the top. */
export default function PeopleSearch({ initialQ, initialResults }: { initialQ: string; initialResults: FoundPerson[] }) {
  const [q, setQ] = useState(initialQ);
  const [shownQ, setShownQ] = useState(initialQ);
  const [results, setResults] = useState(initialResults);
  const [pending, start] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    start(async () => {
      const found = term.length >= 2 ? await findPeople(term) : [];
      setResults(found);
      setShownQ(term);
      try {
        const url = new URL(window.location.href);
        if (term) url.searchParams.set("q", term);
        else url.searchParams.delete("q");
        window.history.replaceState(window.history.state, "", url);
      } catch {}
    });
  }

  return (
    <>
      <form onSubmit={search} className="friend-search" role="search">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="q">Search by name or page name</label>
          <input
            id="q"
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="a name, or hoshigo.cc/name"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </button>
      </form>
      <div aria-live="polite">
        {shownQ.length >= 2 &&
          (results.length === 0 ? (
            <p className="bio">Nobody found for &ldquo;{shownQ}&rdquo;.</p>
          ) : (
            <ul className="friend-list">
              {results.map((p) => (
                <li key={p.id}>
                  <Link href={`/${p.handle}`} className="friend-row">
                    <span className="friend-name">{p.name}</span>
                    <span className="friend-handle">@{p.handle}</span>
                    {p.relation && <span className="friend-tagline">{p.relation}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </>
  );
}
