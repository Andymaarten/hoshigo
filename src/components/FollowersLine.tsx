"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { PersonName } from "@/lib/follows";

const STEP = 10;

/** Only on your own page: "You have 3 followers (only visible to you)." The number opens the names. */
export default function FollowersLine({ people }: { people: PersonName[] }) {
  const [shown, setShown] = useState(0);
  if (!people.length) return null;
  const n = people.length;
  const visible = people.slice(0, shown);
  const rest = n - visible.length;

  return (
    <div className="people-line">
      <p style={{ margin: 0 }}>
        You have{" "}
        <button type="button" className="text-btn" aria-expanded={shown > 0} onClick={() => setShown(shown ? 0 : Math.min(STEP, n))}>
          {n === 1 ? "1 follower" : `${n} followers`}
        </button>{" "}
        (only visible to you).
      </p>
      {shown > 0 && (
        <p style={{ margin: "4px 0 0" }}>
          {visible.map((p, i) => (
            <Fragment key={p.handle}>
              {i > 0 && ", "}
              <Link href={`/${p.handle}`}>{p.display_name || p.handle}</Link>
            </Fragment>
          ))}
          {rest > 0 && (
            <>
              {", "}
              <button type="button" className="text-btn" onClick={() => setShown(Math.min(shown + STEP, n))}>
                {Math.min(STEP, rest)} more
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
