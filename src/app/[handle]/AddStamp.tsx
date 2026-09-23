"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/supabase/types";
import { addItem } from "./actions";
import Sheet from "@/components/Sheet";
import CoverImage from "@/components/CoverImage";
import { displayUrl, extractUrl, stripTracking } from "@/lib/link-input";
import { BY_LABEL, COVER_FROM_CATALOG, SEARCHABLE, SEARCH_HINT, SHAPE, SOURCE_NAME } from "@/lib/category-display";

// One decision per screen:
//   start → "Paste a link" → link → (what is it?) → details
//   start → "Find it yourself" → what is it? → search (or manual) → details
type Screen = "start" | "link" | "category" | "search" | "details";
type Path = "paste" | "choose";

type Candidate = {
  source: string;
  source_id: string;
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
  work_title?: string;
  work_image_url?: string | null;
  detail?: string | null;
};

type Draft = { title: string; by: string; year: string; image: string; note: string };
const emptyDraft: Draft = { title: "", by: "", year: "", image: "", note: "" };

async function fetchJson(url: string, init?: RequestInit, ms = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function uniq(list: (string | null | undefined)[]) {
  return [...new Set(list.filter((s): s is string => !!s))];
}

export default function AddStamp({ handle, categories }: { handle: string; categories: Category[] }) {
  const [pinned, setPinned] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const boundAdd = addItem.bind(null, handle);
  const [error, action, pending] = useActionState(boundAdd, null);
  const wasPending = useRef(false);

  const [screen, setScreen] = useState<Screen>("start");
  const [path, setPath] = useState<Path>("paste");
  const [categoryId, setCategoryId] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [linkInput, setLinkInput] = useState("");
  const [notALink, setNotALink] = useState(false);
  const [reading, setReading] = useState(false);
  const [readNotice, setReadNotice] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [ownLink, setOwnLink] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photos, setPhotos] = useState<string[]>([]);
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([]);
  const [showPhotoLink, setShowPhotoLink] = useState(false);
  const [workId, setWorkId] = useState("");
  const [matchedSource, setMatchedSource] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [formError, setFormError] = useState("");

  const category = categories.find((c) => String(c.id) === categoryId);
  const slug = category?.slug ?? "";

  function reset() {
    setScreen("start");
    setPath("paste");
    setCategoryId("");
    setSuggested([]);
    setShowAllCategories(false);
    setLinkInput("");
    setNotALink(false);
    setReading(false);
    setReadNotice("");
    setLink("");
    setTarget("");
    setSourceLabel("");
    setOwnLink("");
    setQuery("");
    setResults(null);
    setSearching(false);
    setSearchFailed(false);
    setPicking(null);
    setDraft(emptyDraft);
    setPhotos([]);
    setBrokenPhotos([]);
    setShowPhotoLink(false);
    setWorkId("");
    setMatchedSource(null);
    setFormError("");
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
    if (wasPending.current && !pending && !error) {
      setOpen(false);
      reset();
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function clearMatch() {
    setWorkId("");
    setMatchedSource(null);
  }

  // Tries to tie what we read from a link to a catalog entry. Never touches the link.
  async function lookUp(catId: string, title: string, by: string, year: string, url: string, basePhotos: string[]) {
    const cat = categories.find((c) => String(c.id) === catId);
    clearMatch();
    if (!cat || (!SEARCHABLE.has(cat.slug) && cat.slug !== "videos")) return;
    if (!title && cat.slug !== "videos") return;
    setLooking(true);
    try {
      const data = await fetchJson(
        "/api/resolve-work",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category_id: cat.id,
            category_slug: cat.slug,
            title,
            by: by || undefined,
            year: year ? Number(year) : undefined,
            url: url || undefined,
          }),
        },
        15000
      );
      const w = data?.work;
      // A fuzzy place hit is often a different place with a similar name; don't link it.
      const sure = w?.match_confidence === "high";
      if (w && (sure || cat.slug !== "places")) {
        setWorkId(w.id);
        setMatchedSource(w.source);
        setDraft((d) => ({
          ...d,
          // Only a near exact match may replace the title the person's own link gave us.
          title: (sure || !d.title ? w.title : d.title) || d.title,
          by: w.by || d.by,
          year: w.year ? String(w.year) : "",
          image: w.image_url || d.image,
        }));
        setPhotos(uniq([w.image_url, ...basePhotos]));
      }
    } catch {
      // no match is fine: what we read from the page still works
    } finally {
      setLooking(false);
    }
  }

  async function readLink() {
    const url = extractUrl(linkInput);
    if (!url) {
      setNotALink(true);
      return;
    }
    setNotALink(false);
    setReading(true);
    setReadNotice("");
    const cleaned = stripTracking(url);
    let data: Record<string, unknown> = {};
    try {
      data = await fetchJson(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
    } catch {
      data = { status: "timeout" };
    }
    const finalLink = typeof data.link === "string" ? data.link : cleaned;
    setLink(finalLink);
    setTarget(typeof data.target === "string" ? data.target : "");
    setSourceLabel(typeof data.source_label === "string" ? data.source_label : new URL(finalLink).hostname.replace(/^www\./, ""));
    const title = typeof data.title === "string" ? data.title : "";
    const by = typeof data.by === "string" ? data.by : "";
    const year = typeof data.year === "number" ? String(data.year) : "";
    const pagePhotos = uniq([data.image_url as string, ...((data.image_urls as string[]) ?? [])]);
    setDraft({ ...emptyDraft, title, by, image: pagePhotos[0] ?? "" });
    setPhotos(pagePhotos);
    setBrokenPhotos([]);
    clearMatch();

    if (!title) {
      setReadNotice(
        data.status === "blocked"
          ? "That site doesn't let us read its pages, so fill in the title yourself."
          : data.status === "timeout"
            ? "That page took too long to answer, so fill in the title yourself."
            : "We couldn't read that page, so fill in the title yourself."
      );
    } else if (data.title_from_url) {
      setReadNotice("We couldn't read that page, so we guessed the title from the link. Check it below.");
    }

    const alternatives = ((data.alternatives as string[]) ?? []).filter((s) => categories.some((c) => c.slug === s));
    const detected = categories.find((c) => c.slug === data.category_slug);
    setPath("paste");
    setReading(false);
    if (!detected || data.confidence === "low") {
      setSuggested(alternatives.length ? alternatives : uniq([detected?.slug, "things", "essays"]));
      setCategoryId("");
      setShowAllCategories(false);
      setScreen("category");
      return;
    }
    setCategoryId(String(detected.id));
    setSuggested(data.confidence === "medium" ? alternatives : []);
    setScreen("details");
    await lookUp(String(detected.id), title, by, year, finalLink, pagePhotos);
  }

  function chooseCategory(id: string) {
    const cat = categories.find((c) => String(c.id) === id);
    if (!cat) return;
    setCategoryId(id);
    setShowAllCategories(false);
    if (path === "choose") {
      clearMatch();
      setResults(null);
      if (SEARCHABLE.has(cat.slug)) {
        setScreen("search");
        if (query.trim()) runSearch(query, cat.slug);
      } else {
        setDraft((d) => ({ ...d, title: d.title || query.trim() }));
        setScreen("details");
      }
    } else {
      setScreen("details");
      lookUp(id, draft.title, draft.by, "", link, photos);
    }
  }

  async function runSearch(q: string, catSlug = slug) {
    const term = q.trim();
    if (!term || !catSlug) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchFailed(false);
    try {
      const data = await fetchJson(`/api/search-works?category=${encodeURIComponent(catSlug)}&q=${encodeURIComponent(term)}`);
      if (seq === searchSeq.current) setResults(data.results ?? []);
    } catch {
      if (seq === searchSeq.current) {
        setSearchFailed(true);
        setResults(null);
      }
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  useEffect(() => {
    if (screen !== "search" || query.trim().length < 2) return;
    const t = setTimeout(() => runSearch(query), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, screen]);

  async function pickResult(r: Candidate) {
    setPicking(r.source_id);
    let id = "";
    try {
      const data = await fetchJson(
        "/api/search-works",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_id: category?.id, candidate: r }) },
        10000
      );
      id = data?.work_id ?? "";
    } catch {
      // still usable without the catalog link
    }
    setWorkId(id);
    setMatchedSource(id ? r.source : null);
    setDraft((d) => ({ ...d, title: r.title, by: r.by ?? "", year: r.year ? String(r.year) : "", image: r.image_url ?? "" }));
    setPhotos(uniq([r.image_url]));
    setBrokenPhotos([]);
    setPicking(null);
    setScreen("details");
  }

  function addByHand() {
    clearMatch();
    setDraft((d) => ({ ...d, title: d.title || query.trim(), by: "", year: "", image: "" }));
    setPhotos([]);
    setScreen("details");
  }

  function searchInstead() {
    setQuery(draft.title);
    setResults(null);
    setScreen("search");
    if (draft.title) runSearch(draft.title);
  }

  const visiblePhotos = photos.filter((p) => !brokenPhotos.includes(p));
  const coverLocked = !!workId && COVER_FROM_CATALOG.has(slug);
  const ownLinkClean = ownLink.trim() ? extractUrl(ownLink) : null;
  const finalUrl = path === "paste" ? link : ownLinkClean ? stripTracking(ownLinkClean) : "";
  const finalSourceLabel =
    path === "paste" ? sourceLabel : finalUrl ? new URL(finalUrl).hostname.replace(/^www\./, "") : "";

  function renderPreview() {
    const shape = SHAPE[slug];
    return (
      <div className="preview" aria-label="Preview of your listing">
        <span className="preview-label">Preview</span>
        <div className="preview-item">
          <div className={`thumb${shape === "tall" ? " tall" : ""}${shape === "photo" ? " photo" : ""}`}>
            {draft.year && <span>{draft.year}</span>}
            <CoverImage src={draft.image} eager />
          </div>
          <div className="txt">
            <span className="title">{draft.title || "Title"}</span>
            {draft.by && <span className="by">{draft.by}</span>}
          </div>
        </div>
      </div>
    );
  }

  function renderBack(to: Screen) {
    return (
      <button type="button" className="btn" onClick={() => setScreen(to)}>
        Back
      </button>
    );
  }

  function renderCategoryButtons(slugs?: string[]) {
    const list = slugs ? slugs.map((s) => categories.find((c) => c.slug === s)).filter((c): c is Category => !!c) : categories;
    return (
      <div className="cat-grid">
        {list.map((c) => (
          <button key={c.id} type="button" className="cat-btn" onClick={() => chooseCategory(String(c.id))}>
            {c.label}
          </button>
        ))}
      </div>
    );
  }

  const title = {
    start: "Add a hoshigo",
    link: "Paste a link",
    category: path === "paste" ? "What is this?" : "What are you adding?",
    search: `Find ${category?.label ?? "it"}`,
    details: "Check and add",
  }[screen];

  return (
    <>
      <div ref={slotRef} className="stamp-slot">
        <button
          type="button"
          className={`stamp${pinned ? " pinned" : ""}`}
          aria-haspopup="dialog"
          aria-label="Press here to add a hoshigo"
          onClick={() => {
            reset();
            setOpen(true);
          }}
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

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="add-title">
        <h3 id="add-title">{title}</h3>

        {screen === "start" && (
          <div className="choice-list">
            <button type="button" className="choice" onClick={() => setScreen("link")}>
              <strong>Paste a link</strong>
              <span>From Spotify, IMDb, Goodreads, a shop, anywhere. We fill in the rest.</span>
            </button>
            <button
              type="button"
              className="choice"
              onClick={() => {
                setPath("choose");
                setScreen("category");
              }}
            >
              <strong>Find it yourself</strong>
              <span>Pick a category and search for the film, album, book or place.</span>
            </button>
          </div>
        )}

        {screen === "link" && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              readLink();
            }}
          >
            <div className="field">
              <label htmlFor="link-input">Link</label>
              <input
                id="link-input"
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Paste it here"
                value={linkInput}
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  setNotALink(false);
                }}
                autoFocus
              />
              <span className="hint">Share text from an app works too.</span>
            </div>
            {notALink && (
              <div className="notice">
                <p>That doesn&apos;t look like a link.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setQuery(linkInput.trim());
                    setPath("choose");
                    setScreen("category");
                  }}
                >
                  Search for “{linkInput.trim().slice(0, 40)}” instead
                </button>
              </div>
            )}
            <div className="actions">
              {renderBack("start")}
              <button type="submit" className="cta" disabled={reading || !linkInput.trim()}>
                {reading ? "Reading the link…" : "Continue"}
              </button>
            </div>
          </form>
        )}

        {screen === "category" && (
          <div className="stack">
            {path === "paste" && readNotice && <p className="hint">{readNotice}</p>}
            {path === "paste" && suggested.length > 0 && !showAllCategories ? (
              <>
                <p className="hint">We&apos;re not sure. Tap the one that fits.</p>
                {renderCategoryButtons(suggested)}
                <button type="button" className="linkish" onClick={() => setShowAllCategories(true)}>
                  Something else
                </button>
              </>
            ) : (
              renderCategoryButtons()
            )}
            <div className="actions">
              {renderBack(path === "paste" ? "link" : "start")}
            </div>
          </div>
        )}

        {screen === "search" && (
          <div className="stack">
            <form
              className="search-row"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(query);
              }}
            >
              <input
                aria-label={`Search ${category?.label ?? ""}`}
                type="search"
                enterKeyHint="search"
                placeholder={SEARCH_HINT[slug] ?? "Search"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn" disabled={!query.trim() || searching}>
                Search
              </button>
            </form>

            {searching && <p className="hint">Searching…</p>}
            {!searching && searchFailed && <p className="hint">Search isn&apos;t answering right now. Try again, or add it by hand.</p>}
            {!searching && results && results.length === 0 && (
              <p className="hint">Nothing found for “{query.trim()}”. Try fewer words, or check the spelling.</p>
            )}
            {results && results.length > 0 && (
              <ul className="results" aria-busy={searching}>
                {results.map((r) => (
                  <li key={`${r.source}:${r.source_id}`}>
                    <button type="button" className="result" disabled={!!picking} onClick={() => pickResult(r)}>
                      <span className={`thumb${SHAPE[slug] === "tall" ? " tall" : ""}${SHAPE[slug] === "photo" ? " photo" : ""}`}>
                        <CoverImage src={r.image_url} small />
                      </span>
                      <span className="result-txt">
                        <span className="title">{r.title}</span>
                        <span className="by">{[r.by, r.year].filter(Boolean).join(", ")}</span>
                        {r.detail && <span className="result-detail">{r.detail}</span>}
                      </span>
                      {picking === r.source_id && <span className="hint">…</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="linkish" onClick={addByHand}>
              Can&apos;t find it? Add it by hand
            </button>
            <div className="actions">
              {renderBack(path === "paste" ? "details" : "category")}
            </div>
          </div>
        )}

        {screen === "details" && (
          <form
            action={(fd) => {
              if (path === "choose" && ownLink.trim() && !ownLinkClean) {
                setFormError("That link doesn't look right. Fix it or leave it empty.");
                return;
              }
              setFormError("");
              action(fd);
            }}
            className="stack"
          >
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="url" value={finalUrl} />
            <input type="hidden" name="source_label" value={finalUrl ? finalSourceLabel : ""} />
            <input type="hidden" name="work_id" value={workId} />
            <input type="hidden" name="year" value={workId ? draft.year : ""} />
            <input type="hidden" name="image_url" value={draft.image} />

            {readNotice && path === "paste" && <p className="hint">{readNotice}</p>}

            {renderPreview()}

            <p className="cat-line">
              In <strong>{category?.label}</strong>
              {looking && <span> · looking it up…</span>}
              {!looking && matchedSource && <span> · found in {SOURCE_NAME[matchedSource] ?? matchedSource}</span>}
              {" · "}
              <button type="button" className="linkish" onClick={() => setScreen("category")}>
                change
              </button>
              {SEARCHABLE.has(slug) && (
                <>
                  {" · "}
                  <button type="button" className="linkish" onClick={searchInstead}>
                    {matchedSource ? "not this one?" : "search for it"}
                  </button>
                </>
              )}
            </p>
            {path === "paste" && suggested.length > 1 && !workId && (
              <div className="chip-row" aria-label="Other likely categories">
                {suggested
                  .filter((s) => s !== slug)
                  .map((s) => {
                    const c = categories.find((x) => x.slug === s);
                    return c ? (
                      <button key={s} type="button" className="chip" onClick={() => chooseCategory(String(c.id))}>
                        Is it {c.label}?
                      </button>
                    ) : null;
                  })}
              </div>
            )}

            <div className="field">
              <label htmlFor="add-title-input">Title</label>
              <input
                id="add-title-input"
                name="title"
                required
                value={draft.title}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, title: e.target.value }));
                  if (workId) clearMatch();
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="add-by">
                {BY_LABEL[slug] ?? "By"} <span className="optional">optional</span>
              </label>
              <input id="add-by" name="by" value={draft.by} onChange={(e) => setDraft((d) => ({ ...d, by: e.target.value }))} />
            </div>

            {!coverLocked && (
              <div className="field">
                <span className="field-label">Photo</span>
                {visiblePhotos.length > 0 && (
                  <div className="photo-row" role="radiogroup" aria-label="Choose a photo">
                    {visiblePhotos.map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={draft.image === p}
                        className={`photo-tile${draft.image === p ? " selected" : ""}`}
                        onClick={() => setDraft((d) => ({ ...d, image: p }))}
                      >
                        <CoverImage
                          src={p}
                          rejectOdd={!workId}
                          onFail={() => {
                            setBrokenPhotos((b) => [...b, p]);
                            setDraft((d) => (d.image === p ? { ...d, image: "" } : d));
                          }}
                        />
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!draft.image}
                      className={`photo-tile none${!draft.image ? " selected" : ""}`}
                      onClick={() => setDraft((d) => ({ ...d, image: "" }))}
                    >
                      No photo
                    </button>
                  </div>
                )}
                <button type="button" className="linkish" onClick={() => setShowPhotoLink((v) => !v)}>
                  {showPhotoLink ? "Hide photo link" : visiblePhotos.length ? "Use another photo" : "Add a photo"}
                </button>
                {showPhotoLink && (
                  <input
                    aria-label="Photo link"
                    type="url"
                    inputMode="url"
                    placeholder="Paste a link to a photo"
                    onChange={(e) => {
                      const u = extractUrl(e.target.value);
                      if (u) {
                        setPhotos((ps) => uniq([u, ...ps]));
                        setDraft((d) => ({ ...d, image: u }));
                      }
                    }}
                  />
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor="add-note">
                Why five stars? <span className="optional">optional</span>
              </label>
              <textarea id="add-note" name="note" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
            </div>

            {path === "paste" ? (
              <div className="link-box">
                <span className="field-label">Visitors will go to</span>
                <a href={link} target="_blank" rel="noopener" className="link-dest-big">
                  {displayUrl(link, 80)}
                </a>
                {target && <span className="hint">This short link opens {displayUrl(target, 60)}</span>}
                <button type="button" className="linkish" onClick={() => setScreen("link")}>
                  Use a different link
                </button>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="add-own-link">
                  Link <span className="optional">optional</span>
                </label>
                <input
                  id="add-own-link"
                  type="text"
                  inputMode="url"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Where should visitors go?"
                  value={ownLink}
                  onChange={(e) => setOwnLink(e.target.value)}
                />
                <span className="hint">
                  {finalUrl ? `Visitors will go to ${displayUrl(finalUrl, 60)}` : "Without a link, your listing doesn't open anything."}
                </span>
              </div>
            )}

            {(formError || error) && <p className="error">{formError || error}</p>}
            <div className="actions">
              {renderBack(path === "paste" ? "link" : SEARCHABLE.has(slug) ? "search" : "category")}
              <button type="submit" className="cta" disabled={pending || !draft.title.trim() || looking}>
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
