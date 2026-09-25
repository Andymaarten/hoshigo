"use client";

import { useState } from "react";
import Link from "next/link";

const PAGE = 10;

/** Your friends, ten at a time. All names are already here, so paging is instant. */
export default function FriendRows({ people }: { people: { id: string; handle: string; name: string }[] }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(people.length / PAGE);
  const shown = people.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <>
      <ul className="friend-list">
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={`/${p.handle}`} className="friend-row">
              <span className="friend-name">{p.name}</span>
              <span className="friend-handle">@{p.handle}</span>
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="sheet-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-small" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
            Previous
          </button>
          <button type="button" className="btn btn-small" disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  );
}
