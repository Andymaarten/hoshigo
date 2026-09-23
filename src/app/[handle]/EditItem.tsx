"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category, Item } from "@/lib/supabase/types";
import { updateItem } from "./actions";
import CoverImage from "@/components/CoverImage";

export default function EditItem({
  handle,
  item,
  categories,
  onDone,
  onCancel,
}: {
  handle: string;
  item: Item;
  categories: Category[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const boundUpdate = updateItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundUpdate, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [categoryId, setCategoryId] = useState(String(item.category_id));
  const [title, setTitle] = useState(item.title);
  const [by, setBy] = useState(item.by ?? "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [showPhotoLink, setShowPhotoLink] = useState(false);
  const [note, setNote] = useState(item.note ?? "");

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      onDone();
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="item_id" value={item.id} />

      <div className="field">
        <label htmlFor="edit-category_id">Category</label>
        <select id="edit-category_id" name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input id="edit-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="edit-by">By</label>
        <input id="edit-by" name="by" value={by} onChange={(e) => setBy(e.target.value)} />
      </div>
      <input type="hidden" name="year" value={item.year ?? ""} />
      <input type="hidden" name="image_url" value={imageUrl} />
      <div className="field">
        <span className="field-label">Photo</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="thumb" style={{ width: 52, height: 52 }}>
            <CoverImage src={imageUrl} />
          </div>
          <button type="button" className="linkish" onClick={() => setShowPhotoLink((v) => !v)}>
            {showPhotoLink ? "Done" : "Use a different photo"}
          </button>
          {imageUrl && (
            <button type="button" className="linkish" onClick={() => setImageUrl("")}>
              Remove photo
            </button>
          )}
        </div>
        {showPhotoLink && (
          <input
            aria-label="Photo link"
            type="url"
            inputMode="url"
            placeholder="Paste a link to a photo"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value.trim())}
          />
        )}
      </div>
      <div className="field">
        <label htmlFor="edit-note">Note</label>
        <textarea id="edit-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
