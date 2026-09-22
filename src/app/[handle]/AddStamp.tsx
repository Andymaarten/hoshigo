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

  function resetForm() {
    setStep("link");
    setUrl("");
    setFields(emptyFields);
    setFetchFailed(false);
    setAutoDetected(false);
    setCategoryId(String(categories[0]?.id ?? ""));
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
    try {
      const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.title || data.image_url) {
        setFields((f) => ({
          ...f,
          title: data.title || "",
          image_url: data.image_url || "",
          year: data.year ? String(data.year) : "",
          source_label: data.source_label || "",
        }));
        const match = categories.find((c) => c.slug === data.category_slug);
        if (match) {
          setCategoryId(String(match.id));
          setAutoDetected(true);
        }
      } else {
        setFetchFailed(true);
      }
    } catch {
      setFetchFailed(true);
    } finally {
      setFetching(false);
      setStep("review");
    }
  }

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
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  name="title"
                  required
                  value={fields.title}
                  onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
                />
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
