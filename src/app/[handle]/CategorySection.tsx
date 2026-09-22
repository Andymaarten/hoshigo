"use client";

import { useActionState, useState } from "react";
import type { Category, Item } from "@/lib/supabase/types";
import { addItem, deleteItem, updateNote } from "./actions";

function Thumb({ item, big }: { item: Item; big?: boolean }) {
  return (
    <div className={`thumb${big ? "" : ""}`}>
      {item.year && <span>{item.year}</span>}
      {item.image_url && <img src={item.image_url} alt="" />}
    </div>
  );
}

function Row({
  item,
  handle,
  isOwner,
}: {
  item: Item;
  handle: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <li>
      <button type="button" className="row-item" onClick={() => setOpen((v) => !v)}>
        <span className="row-title">{item.title}</span>
        <span className="row-by">{item.by}</span>
      </button>
      {open && (
        <div style={{ display: "flex", gap: 16, padding: "12px 0 24px", flexWrap: "wrap" }}>
          <div style={{ width: 120, flexShrink: 0 }}>
            <Thumb item={item} />
          </div>
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
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
                      await updateNote(handle, item.id, note);
                      setSaving(false);
                    }}
                  >
                    {saving ? "Saving…" : "Save note"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => deleteItem(handle, item.id)}
                    style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <p className="bio" style={{ fontStyle: "italic" }}>
                {item.note || "No note yet."}
              </p>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener" className="btn" style={{ alignSelf: "flex-start" }}>
                Open {item.source_label || "link"}
              </a>
            )}
          </div>
        </div>
      )}
    </li>
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
  const [adding, setAdding] = useState(false);
  const boundAdd = addItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundAdd, null);

  const featured = items.find((i) => i.featured) || items[0];
  const rest = items.filter((i) => i !== featured);

  return (
    <section aria-labelledby={`h-${category.slug}`}>
      <h2 id={`h-${category.slug}`}>{category.label}</h2>

      {featured ? (
        <div className="spread">
          <div className="item" style={{ cursor: "default" }}>
            <Thumb item={featured} big />
            <div className="txt">
              <span className="title">{featured.title}</span>
              <span className="by">{featured.by}</span>
              {isOwner && (
                <button
                  type="button"
                  className="btn"
                  style={{ marginTop: 8, alignSelf: "flex-start", fontSize: 13 }}
                  onClick={() => deleteItem(handle, featured.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <ul className="rows">
            {rest.map((item) => (
              <Row key={item.id} item={item} handle={handle} isOwner={isOwner} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="bio">Nothing here yet.</p>
      )}

      {isOwner && (
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : `+ add to ${category.label}`}
          </button>
          {adding && (
            <form
              action={action}
              style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}
            >
              <input type="hidden" name="category_id" value={category.id} />
              <div className="field">
                <label>Title</label>
                <input name="title" required />
              </div>
              <div className="field">
                <label>By</label>
                <input name="by" />
              </div>
              <div className="field">
                <label>Year</label>
                <input name="year" inputMode="numeric" />
              </div>
              <div className="field">
                <label>Link</label>
                <input name="url" type="url" placeholder="https://…" />
              </div>
              <div className="field">
                <label>Image URL</label>
                <input name="image_url" type="url" placeholder="https://…" />
              </div>
              <div className="field">
                <label>Note</label>
                <textarea name="note" />
              </div>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
                {pending ? "Adding…" : "Add"}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
