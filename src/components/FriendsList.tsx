"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";

export interface Friend {
  handle: string;
  displayName: string;
  tagline: string;
}

export default function FriendsList({ friends }: { friends: Friend[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) => f.displayName.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q)
    );
  }, [friends, query]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 28 }}>
        <label htmlFor={inputId}>Search friends</label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or handle"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="bio">No friends match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="friend-list" aria-label="Friends">
          {filtered.map((f) => (
            <li key={f.handle}>
              <Link href={`/${f.handle}`} className="friend-row">
                <span className="friend-name">{f.displayName}</span>
                <span className="friend-handle">@{f.handle}</span>
                <span className="friend-tagline">{f.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
