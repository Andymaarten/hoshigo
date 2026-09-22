"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/supabase/types";
import { addItem } from "./actions";

export default function AddStamp({ handle, categories }: { handle: string; categories: Category[] }) {
  const [pinned, setPinned] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAdd = addItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundAdd, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function onScroll() {
      if (!slotRef.current) return;
      const threshold = slotRef.current.getBoundingClientRect().top + window.scrollY - 12;
      setPinned(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!pending && !error && formRef.current) {
      formRef.current.reset();
      dialogRef.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <>
      <div ref={slotRef} className="stamp-slot">
        <button
          type="button"
          className={`stamp${pinned ? " pinned" : ""}`}
          aria-haspopup="dialog"
          aria-label="Press here to add a hoshigo"
          onClick={() => dialogRef.current?.showModal()}
        >
          <svg viewBox="0 0 116 116" aria-hidden="true" focusable="false">
            <defs>
              <path id="ring" d="M58,58 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
            </defs>
            <circle cx="58" cy="58" r="30" />
            <text>
              <textPath href="#ring" textLength="292">
                press here to add a hoshigo · press here to add a hoshigo ·{" "}
              </textPath>
            </text>
          </svg>
        </button>
      </div>

      <dialog ref={dialogRef} className="sheet" aria-labelledby="add-title">
        <div className="sheet-in">
          <button type="button" className="close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
            ×
          </button>
          <h3 id="add-title">Add a hoshigo</h3>
          <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label htmlFor="category_id">Category</label>
              <select id="category_id" name="category_id" required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="by">By</label>
              <input id="by" name="by" />
            </div>
            <div className="field">
              <label htmlFor="year">Year</label>
              <input id="year" name="year" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="url">Link</label>
              <input id="url" name="url" type="url" placeholder="https://…" />
            </div>
            <div className="field">
              <label htmlFor="image_url">Image URL</label>
              <input id="image_url" name="image_url" type="url" placeholder="https://…" />
            </div>
            <div className="field">
              <label htmlFor="note">Note</label>
              <textarea id="note" name="note" />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
              {pending ? "Adding…" : "Add"}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
