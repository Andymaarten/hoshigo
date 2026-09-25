"use client";

import { useRef, useState } from "react";
import { SOMEDAY } from "@/lib/someday";
import { setSomedayNote } from "./actions";

/** A line of your own on a saved card: a quiet "Add a note" that becomes a small field. */
export default function SomedayNote({
  id,
  initial,
  editable,
  listPublic,
  startOpen = false,
}: {
  id: string;
  initial: string | null;
  editable: boolean;
  listPublic: boolean;
  startOpen?: boolean;
}) {
  const [note, setNote] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [editing, setEditing] = useState(startOpen);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  async function commit() {
    if (busy.current) return;
    setEditing(false);
    if (note.trim() === saved.trim()) return;
    busy.current = true;
    const ok = await setSomedayNote(id, note);
    busy.current = false;
    if (ok) {
      setSaved(note.trim());
      setFailed(false);
    } else {
      setNote(saved);
      setFailed(true);
    }
  }

  if (!editable) return saved ? <p className="someday-note">{saved}</p> : null;

  if (editing) {
    return (
      <input
        className="someday-note-input"
        aria-label={SOMEDAY.noteLabel}
        autoFocus
        maxLength={500}
        value={note}
        placeholder={listPublic ? SOMEDAY.notePublicPlaceholder : SOMEDAY.notePlaceholder}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setNote(saved);
            setEditing(false);
          }
        }}
      />
    );
  }

  return saved ? (
    <button type="button" className="someday-note someday-note-edit" onClick={() => setEditing(true)} title={SOMEDAY.noteLabel}>
      {saved}
    </button>
  ) : (
    <>
      <button type="button" className="text-btn someday-note-add" onClick={() => setEditing(true)}>
        {SOMEDAY.addNote}
      </button>
      {failed && <span className="hint">That note didn&apos;t save.</span>}
    </>
  );
}
