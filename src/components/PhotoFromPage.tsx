"use client";

import { useState } from "react";

// "Use another photo": paste any page (shop, Wikipedia, review, Pinterest…) or an image link
// and its photos land in the picker. Only ever reports photos; the item's own link, title and
// category stay as they are. Each new page adds its photos in front of the ones already there.
export default function PhotoFromPage({
  onFound,
  label,
}: {
  onFound: (images: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "found" | "none" | "blocked" | "error" | "not_a_link">("idle");
  const [count, setCount] = useState(0);

  async function find() {
    const url = value.trim();
    if (!url || state === "loading") return;
    setState("loading");
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`/api/page-photos?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(t);
      const data = await res.json();
      const images: string[] = Array.isArray(data?.images) ? data.images : [];
      if (images.length) {
        onFound(images);
        setCount(images.length);
        setState("found");
        setValue("");
      } else {
        setState(data?.status === "blocked" ? "blocked" : data?.status === "not_a_link" ? "not_a_link" : data?.status === "error" ? "error" : "none");
      }
    } catch {
      setState("error");
    }
  }

  const message = {
    idle: "A page with the photo you want works: a shop, Wikipedia, a review. A direct image link works too.",
    loading: "Looking for photos on that page…",
    // Some candidates drop out after loading (too small, broken), so no exact count here.
    found: count === 1 ? "Photo added and picked. Paste another page for more." : "Photos added, best one picked. Paste another page for more.",
    none: "No photos found on that page, try another page.",
    blocked: "That site doesn't let us look at its photos. Try another page, for example Wikipedia.",
    error: "That page couldn't be reached. Check the link or try another page.",
    not_a_link: "That doesn't look like a link.",
  }[state];

  if (!open)
    return (
      <button type="button" className="linkish" onClick={() => setOpen(true)}>
        {label}
      </button>
    );

  return (
    <div className="photo-from-page">
      <div className="search-row">
        <input
          aria-label="Page or image link"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Paste a page or image link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state !== "loading") setState("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
          autoFocus
        />
        <button type="button" className="btn" disabled={!value.trim() || state === "loading"} onClick={find}>
          {state === "loading" ? "…" : "Find photos"}
        </button>
      </div>
      <span className={state === "none" || state === "blocked" || state === "error" || state === "not_a_link" ? "error" : "hint"} aria-live="polite">
        {message}
      </span>
    </div>
  );
}
