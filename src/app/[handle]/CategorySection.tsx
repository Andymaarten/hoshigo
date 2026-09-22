"use client";

import { useRef, useState } from "react";
import type { Category, Item } from "@/lib/supabase/types";
import { deleteItem, updateNote } from "./actions";

const SHAPE: Record<string, "tall" | "photo" | undefined> = {
  films: "tall",
  books: "tall",
  tv: "tall",
  things: "photo",
  games: "photo",
  podcasts: "photo",
};

function Thumb({ item, shape, big }: { item: Item; shape?: "tall" | "photo"; big?: boolean }) {
  return (
    <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}${big ? " big" : ""}`}>
      {item.year && <span>{item.year}</span>}
      {item.image_url && <img src={item.image_url} alt="" />}
    </div>
  );
}

export default function CategorySection({
  category,
  items,
  handle,
  isOwner,
}: {
  category: Category;
  items: Item[];
  handle: string;
  isOwner: boolean;
}) {
  const shape = SHAPE[category.slug];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const VISIBLE = 6;
  const visibleItems = expanded ? items : items.slice(0, VISIBLE);
  const hasMore = items.length > VISIBLE;
  const gridId = `grid-${category.slug}`;

  function open(item: Item) {
    setActive(item);
    setNote(item.note ?? "");
    dialogRef.current?.showModal();
  }

  return (
    <section aria-labelledby={`h-${category.slug}`}>
      <h2 id={`h-${category.slug}`}>{category.label}</h2>
      <ul className="grid" id={gridId}>
        {visibleItems.map((item) => (
          <li key={item.id}>
            <button type="button" className="item" onClick={() => open(item)}>
              <Thumb item={item} shape={shape} />
              <div className="txt">
                <span className="title">{item.title}</span>
                <span className="by">{item.by}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          className="btn load-more"
          aria-expanded={expanded}
          aria-controls={gridId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Load more (${items.length - VISIBLE})`}
        </button>
      )}

      <dialog ref={dialogRef} className="sheet" aria-labelledby={`sheet-title-${category.slug}`}>
        <div className="sheet-in">
          <button type="button" className="close" aria-label="Close" onClick={() => dialogRef.current?.close()}>
            ×
          </button>
          {active && (
            <>
              <Thumb item={active} shape={shape} big />
              <h3 id={`sheet-title-${category.slug}`}>{active.title}</h3>
              <div className="meta">{[active.by, active.year].filter(Boolean).join(", ")}</div>

              {isOwner ? (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="No note yet."
                    style={{
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      fontSize: 16,
                      border: "1px solid var(--rule)",
                      background: "transparent",
                      padding: 10,
                      minHeight: 70,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        await updateNote(handle, active.id, note);
                        setSaving(false);
                      }}
                    >
                      {saving ? "Saving…" : "Save note"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        deleteItem(handle, active.id);
                        dialogRef.current?.close();
                      }}
                      style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <p className={`note${active.note ? "" : " empty"}`}>{active.note || "No note yet."}</p>
              )}

              {active.url && (
                <a href={active.url} target="_blank" rel="noopener" className="btn" style={{ alignSelf: "flex-start" }}>
                  Open {active.source_label || "link"}
                </a>
              )}
            </>
          )}
        </div>
      </dialog>
    </section>
  );
}
