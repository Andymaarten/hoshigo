"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category, Item } from "@/lib/supabase/types";
import { updateItem } from "./actions";
import CoverImage from "@/components/CoverImage";
import PhotoFromPage from "@/components/PhotoFromPage";
import type { PinMap } from "@/lib/item-order";

export default function EditItem({
  handle,
  item,
  categories,
  onDone,
  onCancel,
  pins = null,
}: {
  handle: string;
  item: Item;
  categories: Category[];
  onDone: () => void;
  onCancel: () => void;
  /** my pins per category; null before the pinning migration (no pin option) */
  pins?: PinMap | null;
}) {
  const boundUpdate = updateItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundUpdate, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  const [categoryId, setCategoryId] = useState(String(item.category_id));
  const [title, setTitle] = useState(item.title);
  const [by, setBy] = useState(item.by ?? "");
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [options, setOptions] = useState<string[]>(item.image_url ? [item.image_url] : []);
  const [broken, setBroken] = useState<string[]>([]);
  const [note, setNote] = useState(item.note ?? "");
  const [pin, setPin] = useState(!!item.pinned);
  const otherPin = pins?.[Number(categoryId)];
  const category = categories.find((c) => String(c.id) === categoryId);

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
        <div className="photo-row" role="radiogroup" aria-label="Choose a photo">
          {options
            .filter((p) => !broken.includes(p))
            .map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={imageUrl === p}
                className={`photo-tile${imageUrl === p ? " selected" : ""}`}
                onClick={() => setImageUrl(p)}
              >
                <CoverImage
                  src={p}
                  rejectOdd={p !== item.image_url}
                  onFail={() => {
                    setBroken((b) => [...b, p]);
                    setImageUrl((cur) => (cur === p ? item.image_url ?? "" : cur));
                  }}
                />
              </button>
            ))}
          <button
            type="button"
            role="radio"
            aria-checked={!imageUrl}
            className={`photo-tile none${!imageUrl ? " selected" : ""}`}
            onClick={() => setImageUrl("")}
          >
            No photo
          </button>
        </div>
        <PhotoFromPage
          label={options.length ? "Use another photo" : "Add a photo"}
          onFound={(imgs) => {
            setOptions((o) => [...new Set([...imgs, ...o])]);
            setBroken((b) => b.filter((x) => !imgs.includes(x)));
            setImageUrl(imgs[0]);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="edit-note">Note</label>
        <textarea id="edit-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {pins && (
        <div className="field">
          <input type="hidden" name="pin_choice" value="1" />
          <label className="check-row">
            <input type="checkbox" name="pin" checked={pin} onChange={(e) => setPin(e.target.checked)} />
            Pin to the top of {category?.label ?? "this list"}
          </label>
          {pin && otherPin && otherPin.id !== item.id && (
            <span className="hint">This removes the pin from {otherPin.title}.</span>
          )}
        </div>
      )}
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
