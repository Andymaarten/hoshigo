"use client";

import { useEffect, useState } from "react";
import { saveForSomeday, somedayState } from "@/app/someday/actions";
import { SOMEDAY } from "@/lib/someday";

/** "Save for someday" on someone else's listing. Flips at once; the save runs behind it. */
export default function SaveSomeday({ itemId }: { itemId: string }) {
  const [state, setState] = useState<{ saved: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

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
  if (state.saved) return <span className="btn btn-small btn-on">{SOMEDAY.saved}</span>;
  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          setFailed(false);
          setState({ saved: true });
          saveForSomeday(itemId)
            .then((ok) => {
              if (!ok) {
                setState({ saved: false });
                setFailed(true);
              }
            })
            .catch(() => {
              setState({ saved: false });
              setFailed(true);
            });
        }}
      >
        {SOMEDAY.save}
      </button>
      {failed && (
        <span className="hint" role="status">
          {SOMEDAY.saveFailed}
        </span>
      )}
    </>
  );
}
