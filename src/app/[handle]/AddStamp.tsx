"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/supabase/types";
import { addItem } from "./actions";

type Step = "link" | "review";

const emptyFields = {
  title: "",
  by: "",
  year: "",
  image_url: "",
  note: "",
  source_label: "",
};

// These categories have one definitive cover from their canonical catalog (an album's
// artwork, a book's cover, a song's release art, a podcast's show art) — letting someone
// swap in a random photo scraped off the source page doesn't make sense there. Every other
// category (including canonically-matched ones like films) allows picking between whatever
// candidate photos were found.
const NO_PHOTO_CHOICE = new Set(["albums", "books", "songs", "podcasts"]);

const WORK_SOURCE_LABEL: Record<string, string> = {
  tmdb: "TMDB",
  tmdb_tv: "TMDB",
  musicbrainz: "MusicBrainz",
  openlibrary: "Open Library",
  itunes: "iTunes",
  igdb: "IGDB",
  youtube: "YouTube",
  nominatim: "OpenStreetMap",
};

export default function AddStamp({ handle, categories }: { handle: string; categories: Category[] }) {
  const [pinned, setPinned] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAdd = addItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundAdd, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [step, setStep] = useState<Step>("link");
  const [categoryId, setCategoryId] = useState(String(categories[0]?.id ?? ""));
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [fields, setFields] = useState(emptyFields);
  const [workId, setWorkId] = useState("");
  const [matchedVia, setMatchedVia] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);

  function resetForm() {
    setStep("link");
    setUrl("");
    setFields(emptyFields);
    setFetchFailed(false);
    setAutoDetected(false);
    setCategoryId(String(categories[0]?.id ?? ""));
    setWorkId("");
    setMatchedVia(null);
    setImageCandidates([]);
    setImageIndex(0);
  }

  function cyclePhoto(direction: 1 | -1) {
    if (imageCandidates.length < 2) return;
    const next = (imageIndex + direction + imageCandidates.length) % imageCandidates.length;
    setImageIndex(next);
    setFields((f) => ({ ...f, image_url: imageCandidates[next] }));
  }

  async function lookUpCanonical(title: string, catId: string, by?: string, year?: string, sourceUrl?: string) {
    if (!catId) return;
    setMatching(true);
    try {
      const category = categories.find((c) => String(c.id) === catId);
      if (!category) return;
      if (!title && category.slug !== "videos") return;
      const res = await fetch("/api/resolve-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: category.id,
          category_slug: category.slug,
          title,
          by,
          year: year ? Number(year) : undefined,
          // only used for the videos category's ID-based YouTube resolver — see resolve-work.ts
          url: sourceUrl,
        }),
      });
      const data = await res.json();
      if (data.work) {
        setFields((f) => ({
          ...f,
          title: data.work.title,
          by: data.work.by || f.by,
          year: data.work.year ? String(data.work.year) : f.year,
          image_url: data.work.image_url || f.image_url,
        }));
        setWorkId(data.work.id);
        setMatchedVia(data.work.source);
      } else {
        setWorkId("");
        setMatchedVia(null);
      }
    } catch {
      // canonical lookup is a bonus — the OG/manual data we already have still works
    } finally {
      setMatching(false);
    }
  }

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
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function openDialog() {
    resetForm();
    dialogRef.current?.showModal();
  }

  async function goToReview(skipFetch: boolean) {
    if (skipFetch || !url) {
      setStep("review");
      return;
    }
    setFetching(true);
    setFetchFailed(false);
    let detectedCategoryId = categoryId;
    try {
      const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.title || data.image_url) {
        setFields((f) => ({
          ...f,
          title: data.title || "",
          by: data.by || f.by,
          image_url: data.image_url || "",
          year: data.year ? String(data.year) : "",
          source_label: data.source_label || "",
        }));
        setImageCandidates(data.image_urls || []);
        setImageIndex(0);
        const match = categories.find((c) => c.slug === data.category_slug);
        if (match) {
          detectedCategoryId = String(match.id);
          setCategoryId(detectedCategoryId);
          setAutoDetected(true);
        }
      } else {
        setFetchFailed(true);
      }
      if (data.title || data.category_slug === "videos")
        await lookUpCanonical(data.title, detectedCategoryId, data.by, data.year ? String(data.year) : undefined, url);
    } catch {
      setFetchFailed(true);
    } finally {
      setFetching(false);
      setStep("review");
    }
  }

  const activeCategorySlug = categories.find((c) => String(c.id) === categoryId)?.slug;
  const allowPhotoChoice = !activeCategorySlug || !NO_PHOTO_CHOICE.has(activeCategorySlug);

  return (
    <>
      <div ref={slotRef} className="stamp-slot">
        <button
          type="button"
          className={`stamp${pinned ? " pinned" : ""}`}
          aria-haspopup="dialog"
          aria-label="Press here to add a hoshigo"
          onClick={openDialog}
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

          {step === "link" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p className="bio" style={{ marginTop: 0 }}>
                Paste a link and we&apos;ll figure out what it is.
              </p>
              <div className="field">
                <label htmlFor="link-url">Link</label>
                <input
                  id="link-url"
                  type="url"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="cta"
                style={{ border: "none" }}
                disabled={fetching || !url}
                onClick={() => goToReview(false)}
              >
                {fetching ? "Reading link…" : "Continue"}
              </button>
              <button type="button" className="btn" onClick={() => goToReview(true)}>
                No link — add manually
              </button>
            </div>
          )}

          {step === "review" && (
            <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" name="url" value={url} />
              <input type="hidden" name="source_label" value={fields.source_label} />
              <input type="hidden" name="work_id" value={workId} />

              {fetchFailed && (
                <p className="bio" style={{ fontStyle: "italic", marginTop: 0 }}>
                  Couldn&apos;t read that link automatically — fill it in below.
                </p>
              )}

              <div className="field">
                <label htmlFor="category_id">
                  Category{autoDetected && <span style={{ color: "var(--accent)" }}> — detected</span>}
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setAutoDetected(false);
                    setWorkId("");
                    setMatchedVia(null);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="title">
                  Title
                  {matchedVia && (
                    <span style={{ color: "var(--accent)" }}> — matched via {WORK_SOURCE_LABEL[matchedVia]}</span>
                  )}
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  value={fields.title}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, title: e.target.value }));
                    setWorkId("");
                    setMatchedVia(null);
                  }}
                />
                {!matchedVia && (
                  <button
                    type="button"
                    className="btn"
                    style={{ alignSelf: "flex-start", fontSize: 13, minHeight: 36, padding: "0 12px" }}
                    disabled={matching || !fields.title}
                    onClick={() => lookUpCanonical(fields.title, categoryId, fields.by, fields.year)}
                  >
                    {matching ? "Looking up…" : "Look up canonical record"}
                  </button>
                )}
              </div>
              <div className="field">
                <label htmlFor="by">By</label>
                <input
                  id="by"
                  name="by"
                  value={fields.by}
                  onChange={(e) => setFields((f) => ({ ...f, by: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="year">Year</label>
                <input
                  id="year"
                  name="year"
                  inputMode="numeric"
                  value={fields.year}
                  onChange={(e) => setFields((f) => ({ ...f, year: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="image_url">Image URL</label>
                <input
                  id="image_url"
                  name="image_url"
                  type="url"
                  placeholder="https://…"
                  value={fields.image_url}
                  onChange={(e) => setFields((f) => ({ ...f, image_url: e.target.value }))}
                />
                {allowPhotoChoice && imageCandidates.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    {fields.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fields.image_url}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: "cover", border: "2px solid var(--ink)" }}
                      />
                    )}
                    <button type="button" className="btn" style={{ minHeight: 36, padding: "0 10px" }} onClick={() => cyclePhoto(-1)}>
                      ‹
                    </button>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {imageIndex + 1} / {imageCandidates.length}
                    </span>
                    <button type="button" className="btn" style={{ minHeight: 36, padding: "0 10px" }} onClick={() => cyclePhoto(1)}>
                      ›
                    </button>
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="note">Note</label>
                <textarea
                  id="note"
                  name="note"
                  value={fields.note}
                  onChange={(e) => setFields((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
              {error && <p className="error">{error}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn" onClick={() => setStep("link")}>
                  Back
                </button>
                <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
                  {pending ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
