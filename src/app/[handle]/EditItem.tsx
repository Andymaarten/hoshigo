"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category, Item } from "@/lib/supabase/types";
import { updateItem } from "./actions";
import CoverImage from "@/components/CoverImage";
import PhotoFromPage from "@/components/PhotoFromPage";
import type { PinMap } from "@/lib/item-order";
import { placeDisplay } from "@/lib/place-fields";
import { displayUrl, extractUrl, stripTracking } from "@/lib/link-input";
import { linkHelp } from "@/lib/link-help";
import { SEARCHABLE, SOURCE_NAME } from "@/lib/category-display";

type Match = { id: string; source: string; title: string; year: number | null };

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
  const [place, setPlace] = useState(() => placeDisplay(item));
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");
  const [options, setOptions] = useState<string[]>(item.image_url ? [item.image_url] : []);
  const [broken, setBroken] = useState<string[]>([]);
  const [note, setNote] = useState(item.note ?? "");
  const [pin, setPin] = useState(!!item.pinned);
  const otherPin = pins?.[Number(categoryId)];
  const category = categories.find((c) => String(c.id) === categoryId);
  const slug = category?.slug ?? "";

  // The item's own link can be added or changed at any time. A new link is read for photos,
  // and an item without a catalogue match is looked up again; the match shown is the one saved.
  const [link, setLink] = useState(item.url ?? "");
  const linkClean = link.trim() ? extractUrl(link) : null;
  const finalUrl = linkClean ? stripTracking(linkClean) : "";
  const [readFor, setReadFor] = useState(item.url ?? "");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  const [match, setMatch] = useState<Match | null>(null);
  const readSeq = useRef(0);

  async function readNewLink(url: string) {
    const seq = ++readSeq.current;
    setReadFor(url);
    setMatch(null);
    setReadNote("");
    setReading(true);
    try {
      const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
      const data = res.ok ? await res.json() : null;
      if (seq !== readSeq.current || !data) return;
      if (data.status === "unsupported" && typeof data.notice === "string") {
        setReadNote(data.notice);
        return;
      }
      const found = [data.image_url, ...((data.image_urls as string[]) ?? [])].filter((x): x is string => typeof x === "string" && !!x);
      if (found.length) {
        setOptions((o) => [...new Set([...o, ...found])]);
        setBroken((b) => b.filter((x) => !found.includes(x)));
        setImageUrl((cur) => cur || found[0]);
        setReadNote("Photos from that link are in the photo picker below.");
      }
      if (!item.work_id && category && (SEARCHABLE.has(category.slug) || category.slug === "videos")) {
        const r = await fetch("/api/resolve-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category_id: category.id,
            title: title || data.title || "",
            by: (category.slug === "places" ? "" : by) || data.by || undefined,
            url,
          }),
        });
        const w = r.ok ? (await r.json())?.work : null;
        if (seq !== readSeq.current) return;
        // Same rule as adding: a fuzzy place hit is often another place, so only sure ones.
        if (w?.id && (w.match_confidence === "high" || category.slug !== "places"))
          setMatch({ id: w.id, source: w.source, title: w.title, year: w.year ?? null });
      }
    } catch {
      // the link still saves; reading it is a bonus
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }

  useEffect(() => {
    if (!finalUrl || finalUrl === readFor) return;
    const t = setTimeout(() => readNewLink(finalUrl), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalUrl]);

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
        <select id="edit-category_id" name="category_id" value={categoryId} onChange={(e) => {
            setCategoryId(e.target.value);
            // a match belongs to the catalogue of the category it was found in
            setMatch(null);
            setReadFor("");
          }}>
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
      {category?.slug === "places" ? (
        <>
          <div className="field">
            <label htmlFor="edit-place-type">Type</label>
            <input
              id="edit-place-type"
              name="place_type"
              placeholder="Bar, museum, park…"
              value={place.placeType}
              onChange={(e) => setPlace((p) => ({ ...p, placeType: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-city">Location</label>
            <input
              id="edit-city"
              name="city"
              placeholder="City"
              value={place.city}
              onChange={(e) => setPlace((p) => ({ ...p, city: e.target.value }))}
            />
            <input type="hidden" name="country" value={place.country} />
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="edit-by">By</label>
          <input id="edit-by" name="by" value={by} onChange={(e) => setBy(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="edit-link">
          Link <span className="optional">{!item.work_id && !match && item.url ? "required" : "optional"}</span>
        </label>
        <input
          id="edit-link"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the link visitors should open"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <span className="hint">
          {finalUrl ? `Visitors will go to ${displayUrl(finalUrl, 60)}` : "A link lets your friends find it."}
          {reading ? " Reading the link…" : ""}
        </span>
        {link.trim() && !linkClean && <span className="error">That doesn&apos;t look like a link yet.</span>}
        {readNote && !reading && <span className="hint">{readNote}</span>}
        {!finalUrl && linkHelp(slug, title).length > 0 && (
          <div className="link-help">
            <span className="hint">Find it on</span>
            <div className="sheet-row">
              {linkHelp(slug, title).map((l) => (
                <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-small">
                  {l.name}
                </a>
              ))}
            </div>
          </div>
        )}
        {link && (
          <button type="button" className="text-btn" style={{ alignSelf: "flex-start" }} onClick={() => setLink("")}>
            Clear
          </button>
        )}
        {match && (
          <p className="hint">
            Found in {SOURCE_NAME[match.source] ?? match.source}: {match.title}
            {match.year ? ` (${match.year})` : ""} ·{" "}
            <button type="button" className="linkish" style={{ padding: 0 }} onClick={() => setMatch(null)}>
              not this one?
            </button>
          </p>
        )}
      </div>
      <input type="hidden" name="url" value={finalUrl} />
      <input type="hidden" name="link_sent" value="1" />
      <input type="hidden" name="work_id" value={match?.id ?? ""} />
      <input type="hidden" name="year" value={match?.year ?? item.year ?? ""} />
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
