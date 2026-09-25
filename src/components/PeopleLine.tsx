"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { PersonName } from "@/lib/follows";

const SHOWN = 3;

/** "Friends: Sara, Roelant, Anne and 4 others", the others open in place. No counts elsewhere. */
export default function PeopleLine({ label, people }: { label: string; people: PersonName[] }) {
  const [all, setAll] = useState(false);
  if (!people.length) return null;
  const shown = all ? people : people.slice(0, SHOWN);
  const rest = people.length - shown.length;
  return (
    <p className="people-line">
      <span className="people-label">{label}:</span>{" "}
      {shown.map((p, i) => (
        <Fragment key={p.handle}>
          {i > 0 && (i === shown.length - 1 && rest === 0 ? " and " : ", ")}
          <Link href={`/${p.handle}`}>{p.display_name || p.handle}</Link>
        </Fragment>
      ))}
      {rest > 0 && (
        <>
          {" and "}
          <button type="button" className="text-btn" onClick={() => setAll(true)}>
            {rest === 1 ? "1 other" : `${rest} others`}
          </button>
        </>
      )}
    </p>
  );
}
