"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import type { PersonName } from "@/lib/follows";
import { moreFriends } from "@/app/friends/actions";

const FIRST = 3;
const STEP = 10;

/**
 * "Friends: Sara, Roelant, Anne and 297 others". Each tap shows up to 10 more. With a
 * profileId the extra names are fetched a page at a time; without one, `people` is complete.
 */
export default function PeopleLine({
  label,
  people,
  total,
  profileId,
}: {
  label: string;
  people: PersonName[];
  total: number;
  profileId?: string;
}) {
  const [loaded, setLoaded] = useState(people);
  const [shown, setShown] = useState(Math.min(FIRST, people.length));
  const [pending, start] = useTransition();
  if (!total) return null;

  const visible = loaded.slice(0, shown);
  const rest = total - visible.length;

  function more() {
    const want = shown + STEP;
    if (!profileId || loaded.length >= Math.min(want, total)) {
      setShown(Math.min(want, loaded.length));
      return;
    }
    start(async () => {
      const page = await moreFriends(profileId, loaded.length);
      const next = page ? [...loaded, ...page.people.filter((p) => !loaded.some((l) => l.handle === p.handle))] : loaded;
      setLoaded(next);
      setShown(Math.min(want, next.length));
    });
  }

  return (
    <p className="people-line">
      <span className="people-label">{label}:</span>{" "}
      {visible.map((p, i) => (
        <Fragment key={p.handle}>
          {i > 0 && (i === visible.length - 1 && rest === 0 ? " and " : ", ")}
          <Link href={`/${p.handle}`}>{p.display_name || p.handle}</Link>
        </Fragment>
      ))}
      {rest > 0 && (
        <>
          {shown <= FIRST ? " and " : ", "}
          <button type="button" className="text-btn" disabled={pending} onClick={more}>
            {shown <= FIRST ? (rest === 1 ? "1 other" : `${rest} others`) : `${Math.min(STEP, rest)} more`}
          </button>
        </>
      )}
    </p>
  );
}
