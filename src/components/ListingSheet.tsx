"use client";

import type { ReactNode } from "react";
import type { Item } from "@/lib/supabase/types";
import CoverImage from "@/components/CoverImage";
import SharePanel from "@/components/SharePanel";
import { displayUrl } from "@/lib/link-input";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";
import { ADD_PREFILL_EVENT, type AddPrefill } from "@/lib/item-order";
import { placeDisplay } from "@/lib/place-fields";

// Defense in depth: addItem already rejects non-http(s) links before they're saved, but this
// guards any row that predates that check so a "javascript:" URL can never end up in an href.
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export function Thumb({ item, shape, big }: { item: Item; shape?: "tall" | "photo"; big?: boolean }) {
  return (
    <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}${big ? " big" : ""}`}>
      {item.year && <span>{item.year}</span>}
      <CoverImage src={item.image_url} eager={big} />
    </div>
  );
}

/** The read view of one listing inside a Sheet: cover, title, note, link out and Share. */
export default function ListingSheetBody({
  item,
  shape,
  titleId,
  handle,
  mine,
  shareable,
  friendsOnly,
  noteSlot,
  canAdd = false,
  onAdd,
  isPlace = false,
}: {
  /** the listing is in "places": show type and location instead of the by line */
  isPlace?: boolean;
  item: Item;
  shape?: "tall" | "photo";
  titleId: string;
  handle: string;
  mine: boolean;
  shareable: boolean;
  friendsOnly: boolean;
  /** replaces the plain note, e.g. the owner's note editor */
  noteSlot?: ReactNode;
  /** a logged in visitor: offer "Add to my hoshigo" */
  canAdd?: boolean;
  /** e.g. close this sheet before the add dialog opens */
  onAdd?: () => void;
}) {
  const href = safeHttpUrl(item.url);
  // Places show OSM's type small above the name and the location as the meta line.
  const place = isPlace || item.place_type || item.city ? placeDisplay(item) : null;
  return (
    <>
      <Thumb item={item} shape={shape} big />
      {place?.placeType && <div className="kind">{place.placeType}</div>}
      <h3 id={titleId}>{item.title}</h3>
      <div className="meta">
        {place ? [place.city, place.country].filter(Boolean).join(", ") : [item.by, item.year].filter(Boolean).join(", ")}
      </div>

      {noteSlot ?? <p className={`note${item.note ? "" : " empty"}`}>{item.note || "No note yet."}</p>}

      <div className="sheet-row sheet-out">
        {href && (
          <a href={href} target="_blank" rel="noopener" className="btn btn-small">
            Open {item.source_label || "link"}
          </a>
        )}
        {shareable && (
          <SharePanel key={item.id} handle={handle} itemId={item.id} title={item.title} by={item.by} mine={mine} friendsOnly={friendsOnly} />
        )}
        {canAdd && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              onAdd?.();
              const detail: AddPrefill = {
                categoryId: item.category_id,
                workId: item.work_id,
                title: item.title,
                by: item.by,
                year: item.year,
                url: href,
                sourceLabel: item.source_label,
                imageUrl: item.image_url,
                placeType: place?.placeType || null,
                city: place?.city || null,
                country: place?.country || null,
              };
              window.dispatchEvent(new CustomEvent(ADD_PREFILL_EVENT, { detail }));
            }}
          >
            Keep in my hoshigo
          </button>
        )}
        {href && <span className="link-dest">{displayUrl(item.url!)}</span>}
      </div>
      {!shareable && mine && (
        <p className="meta">Only your newest {PUBLIC_PER_CATEGORY} per list are public, so this one can&rsquo;t be shared yet.</p>
      )}
    </>
  );
}
