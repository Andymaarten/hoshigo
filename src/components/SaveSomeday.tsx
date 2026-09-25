"use client";

import { useEffect, useState, useTransition } from "react";
import { saveForSomeday, somedayState } from "@/app/someday/actions";
import { SOMEDAY } from "@/lib/someday";

/** "Save for someday" on someone else's listing. Renders nothing until it knows it applies. */
export default function SaveSomeday({ itemId }: { itemId: string }) {
  const [state, setState] = useState<{ saved: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    somedayState(itemId)
      .then((s) => live && setState(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [itemId]);

  if (!state) return null;
  if (state.saved) return <span className="btn btn-small btn-on" aria-live="polite">{SOMEDAY.saved}</span>;
  return (
    <button
      type="button"
      className="btn btn-small"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (await saveForSomeday(itemId)) setState({ saved: true });
        })
      }
    >
      {SOMEDAY.save}
    </button>
  );
}
