"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/supabase/types";
import { addItem } from "./actions";
import { addToSomeday } from "../someday/actions";
import { SOMEDAY } from "@/lib/someday";
import { clearPendingAdd } from "../add/actions";
import Sheet from "@/components/Sheet";
import CoverImage from "@/components/CoverImage";
import PhotoFromPage from "@/components/PhotoFromPage";
import { displayUrl, extractUrl, stripTracking } from "@/lib/link-input";
import { linkHelp } from "@/lib/link-help";
import { ADDED_EVENT, ADD_PREFILL_EVENT, type AddPrefill, type PinMap } from "@/lib/item-order";
import { placeLine, splitPlaceLine } from "@/lib/place-fields";
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
  place_type?: string | null;
  city?: string | null;
  country?: string | null;
};

// placeType/city/country are only used for places (OSM's type and location).
type Draft = { title: string; by: string; year: string; image: string; note: string; placeType: string; city: string; country: string };
const emptyDraft: Draft = { title: "", by: "", year: "", image: "", note: "", placeType: "", city: "", country: "" };

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

export default function AddStamp({
  handle,
  categories,
  initialAddLink,
  pins = null,
  onOwnPage = true,
  destination = "items",
  hideStamp = false,
}: {
  handle: string;
  categories: Category[];
  // Set when arriving from /add?url=…: open on "Paste a link" with this text and read it.
  initialAddLink?: string;
  /** my pinned listing per category; null before the pinning migration (no pin option) */
  pins?: PinMap | null;
  /** false on every other page: after adding, say where it landed */
  onOwnPage?: boolean;
  /** "someday": the same dialog saves into your someday list (no note, no pin), opened by a plain button */
  destination?: "items" | "someday";
  /** only the dialog, for prefilled adds (e.g. "Loved it"), without the red stamp */
  hideStamp?: boolean;
}) {
  const someday = destination === "someday";
  const [pinned, setPinned] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const boundAdd = addItem.bind(null, handle);
  const [error, action, pending] = useActionState(someday ? addToSomeday : boundAdd, null);
  const wasPending = useRef(false);

  const [screen, setScreen] = useState<Screen>("start");
  const [path, setPath] = useState<Path>("paste");
  const [categoryId, setCategoryId] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [detected, setDetected] = useState({ slug: "", confidence: "", reason: "" });
  const [changing, setChanging] = useState(false);
  const [changedByUser, setChangedByUser] = useState(false);
  const [pageTitle, setPageTitle] = useState("");
  const [pagePhotos, setPagePhotos] = useState<string[]>([]);
  const [handLinkRead, setHandLinkRead] = useState(false);
  const [readingHand, setReadingHand] = useState(false);
  const [categoryHint, setCategoryHint] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [linkInput, setLinkInput] = useState("");
  const [notALinkQuery, setNotALinkQuery] = useState("");
  const [reading, setReading] = useState(false);
  const [readNotice, setReadNotice] = useState("");
  // a link to a page that can't be added (an IMDb person or list), said on the link screen
  const [linkNotice, setLinkNotice] = useState("");
  // one gentle "no note?" question per add; the ref lets "Add without a note" submit at once
  const [noteNudge, setNoteNudge] = useState(false);
  const noteAsked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
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
  // Bumped whenever the match is cleared (category changed, new link, search pick), so a
  // catalog lookup that answers late can't attach its work to a different category.
  const matchSeq = useRef(0);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [photos, setPhotos] = useState<string[]>([]);
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([]);
  const [workId, setWorkId] = useState("");
  const [matchedSource, setMatchedSource] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [formError, setFormError] = useState("");
  const [pin, setPin] = useState(false);
  // a matched place's own website: the link when the person gives none of their own
  const [catalogSite, setCatalogSite] = useState("");
  // the catalog entry the person picked, even when saving it to our catalog failed
  const [catalogPick, setCatalogPick] = useState("");
  // a picked catalog record that couldn't be linked (catalog busy): say so, don't show a match
  const [linkFailed, setLinkFailed] = useState("");
  const [lastFound, setLastFound] = useState<string[]>([]);
  const [landed, setLanded] = useState<{ label: string; slug: string } | null>(null);
  const submittedCategory = useRef<{ label: string; slug: string } | null>(null);
  const fromSomeday = useRef<string | null>(null);

  const category = categories.find((c) => String(c.id) === categoryId);
  const slug = category?.slug ?? "";

  function reset() {
    fromSomeday.current = null;
    setScreen("start");
    setPath("paste");
    setCategoryId("");
    setSuggested([]);
    setDetected({ slug: "", confidence: "", reason: "" });
    setChanging(false);
    setChangedByUser(false);
    setPageTitle("");
    setPagePhotos([]);
    setHandLinkRead(false);
    setReadingHand(false);
    setCategoryHint("");
    setShowAllCategories(false);
    setLinkInput("");
    setNotALinkQuery("");
    setReading(false);
    setReadNotice("");
    setLinkNotice("");
    setNoteNudge(false);
    noteAsked.current = false;
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
    setWorkId("");
    setMatchedSource(null);
    setFormError("");
    setPin(false);
    setLastFound([]);
    setCatalogSite("");
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
      const somedayId = fromSomeday.current;
      setOpen(false);
      reset();
      if (!onOwnPage && submittedCategory.current) setLanded(submittedCategory.current);
      if (somedayId) window.dispatchEvent(new CustomEvent(ADDED_EVENT, { detail: { somedayId } }));
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Arriving from /add?url=…: open on "Paste a link" with the text filled in and start
  // reading it at once. The address bar goes back to the plain page, and the carried
  // link is forgotten so it doesn't open again on the next visit.
  const addStarted = useRef(false);
  useEffect(() => {
    if (initialAddLink === undefined || addStarted.current) return;
    addStarted.current = true;
    window.history.replaceState(null, "", `/${handle}`);
    clearPendingAdd().catch(() => {});
    reset();
    setPath("paste");
    setScreen("link");
    setLinkInput(initialAddLink);
    setOpen(true);
    // Runs once on arrival; readLink is declared further down and only called here.
    // eslint-disable-next-line react-hooks/immutability
    if (initialAddLink.trim()) readLink(initialAddLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddLink]);

  // "Add to my hoshigo" on someone else's listing: open on the review step with their item.
  // The link stays the item's own link; their note is theirs, so it isn't copied.
  useEffect(() => {
    function onPrefill(e: Event) {
      const p = (e as CustomEvent<AddPrefill>).detail;
      const cat = categories.find((c) => c.id === p?.categoryId);
      if (!cat) return;
      reset();
      fromSomeday.current = p.somedayId ?? null;
      setLanded(null);
      setCategoryId(String(cat.id));
      setWorkId(p.workId ?? "");
      const place = cat.slug === "places" ? { ...splitPlaceLine(p.by), ...(p.placeType || p.city ? { placeType: p.placeType ?? "", city: p.city ?? "" } : {}) } : null;
      setDraft({
        ...emptyDraft,
        title: p.title,
        by: p.by ?? "",
        year: p.year ? String(p.year) : "",
        image: p.imageUrl ?? "",
        placeType: place?.placeType ?? "",
        city: place?.city ?? "",
        country: p.country ?? "",
      });
      setPhotos(uniq([p.imageUrl]));
      if (p.url) {
        setPath("paste");
        setLink(p.url);
        setSourceLabel(p.sourceLabel || new URL(p.url).hostname.replace(/^www\./, ""));
      } else {
        setPath("choose");
        setHandLinkRead(true);
      }
      setScreen("details");
      setOpen(true);
    }
    // prefills ("Add to my hoshigo", "Loved it") are for your page, never the someday dialog
    if (someday) return;
    window.addEventListener(ADD_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(ADD_PREFILL_EVENT, onPrefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  function clearMatch() {
    matchSeq.current++;
    setWorkId("");
    setMatchedSource(null);
    setCatalogSite("");
    // the website we put in the link field belonged to the match that is going away
    if (catalogSite) setOwnLink((o) => (o === catalogSite ? "" : o));
    setCatalogPick("");
    setLinkFailed("");
  }

  function showPlaceSite(site: string) {
    setCatalogSite(site);
    if (site) setOwnLink((o) => (o.trim() ? o : site));
  }

  // Tries to tie what we read from a link to a catalog entry. Never touches the link.
  async function lookUp(catId: string, title: string, by: string, year: string, url: string, basePhotos: string[]) {
    const cat = categories.find((c) => String(c.id) === catId);
    clearMatch();
    const seq = matchSeq.current;
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
      if (seq !== matchSeq.current) return;
      const w = data?.work;
      // A fuzzy place hit is often a different place with a similar name; don't link it.
      const sure = w?.match_confidence === "high";
      if (w && (sure || cat.slug !== "places")) {
        setWorkId(w.id);
        setMatchedSource(w.source);
        if (cat.slug === "places" && typeof w.website === "string" && /^https?:\/\//.test(w.website)) showPlaceSite(w.website);
        setDraft((d) => ({
          ...d,
          // Only a near exact match may replace the title the person's own link gave us.
          title: (sure || !d.title ? w.title : d.title) || d.title,
          by: w.by || d.by,
          year: w.year ? String(w.year) : "",
          image: w.image_url || d.image,
          // Places: OSM's type and location (before the places migration only the
          // combined by line exists, so split that).
          ...(cat.slug === "places"
            ? w.place_type || w.city
              ? { placeType: w.place_type ?? "", city: w.city ?? "", country: w.country ?? "" }
              : splitPlaceLine(w.by)
            : {}),
        }));
        setPhotos(uniq([w.image_url, ...basePhotos]));
      }
    } catch {
      // no match is fine: what we read from the page still works
    } finally {
      setLooking(false);
    }
  }

  async function readLink(input = linkInput) {
    const url = extractUrl(input);
    if (!url) {
      setNotALinkQuery(input.trim());
      return;
    }
    setNotALinkQuery("");
    setLinkNotice("");
    setReading(true);
    setReadNotice("");
    const cleaned = stripTracking(url);
    let data: Record<string, unknown> = {};
    try {
      data = await fetchJson(`/api/fetch-metadata?url=${encodeURIComponent(url)}`);
    } catch {
      data = { status: "timeout" };
    }
    if (data.status === "not_a_link") {
      setReading(false);
      setNotALinkQuery(typeof data.query === "string" && data.query ? data.query : input.trim());
      return;
    }
    if (data.status === "unsupported") {
      setReading(false);
      setLinkNotice(typeof data.notice === "string" ? data.notice : "We can't add that page. Paste the link of the thing itself.");
      return;
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
    setPagePhotos(pagePhotos);
    setPageTitle(title);
    setBrokenPhotos([]);
    clearMatch();
    setDetected({
      slug: typeof data.category_slug === "string" ? data.category_slug : "",
      confidence: typeof data.confidence === "string" ? data.confidence : "",
      reason: typeof data.reason === "string" ? data.reason : "",
    });
    setChangedByUser(false);

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

  function chooseCategory(id: string, isChange = changing) {
    const cat = categories.find((c) => String(c.id) === id);
    if (!cat) return;
    const same = id === categoryId;
    setCategoryId(id);
    setShowAllCategories(false);
    setChanging(false);
    if (path === "paste" && isChange) {
      setChangedByUser(true);
      if (same) {
        setScreen("details");
        return;
      }
      // What we filled in was read for the wrong category, so start the fields over.
      // The link and the page's own photos stay; catalog data goes.
      clearMatch();
      setDraft((d) => ({ ...d, title: "", by: "", year: "", image: pagePhotos[0] ?? "" }));
      setPhotos(pagePhotos);
      setBrokenPhotos([]);
      setResults(null);
      if (SEARCHABLE.has(cat.slug)) {
        setQuery(pageTitle);
        setScreen("search");
        if (pageTitle) runSearch(pageTitle, cat.slug);
      } else {
        setScreen("details");
      }
      return;
    }
    if (path === "choose") {
      clearMatch();
      setResults(null);
      setHandLinkRead(false);
      setCategoryHint("");
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
    clearMatch();
    const seq = matchSeq.current;
    setPicking(r.source_id);
    let id = "";
    let site = "";
    let sitePhoto = "";
    try {
      const data = await fetchJson(
        "/api/search-works",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_id: category?.id, candidate: r }) },
        10000
      );
      id = data?.work_id ?? "";
      site = typeof data?.website === "string" && /^https?:\/\//.test(data.website) ? data.website : "";
      // a photo found on the place's own website, when the catalog had none
      sitePhoto = !r.image_url && typeof data?.image_url === "string" ? data.image_url : "";
    } catch {
      // still usable without the catalog link
    }
    if (seq !== matchSeq.current) {
      setPicking(null);
      return;
    }
    setWorkId(id);
    setMatchedSource(id ? r.source : null);
    showPlaceSite(id ? site : "");
    setCatalogPick(r.source);
    setLinkFailed(id ? "" : r.source);
    const photo = r.image_url || sitePhoto;
    setDraft((d) => ({
      ...d,
      title: r.title,
      by: r.by ?? "",
      year: r.year ? String(r.year) : "",
      image: photo,
      placeType: r.place_type ?? "",
      city: r.city ?? "",
      country: r.country ?? "",
    }));
    setPhotos(uniq([photo]));
    setBrokenPhotos([]);
    setPicking(null);
    setScreen("details");
  }

  function addByHand() {
    clearMatch();
    setHandLinkRead(false);
    setCategoryHint("");
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
  // Owner rule: only a catalog match (or pick) may go without a link.
  const fromCatalog = !!workId || !!catalogPick;
  const linkRequired = !fromCatalog;
  // Hand-added items (no catalog match) start with the link; the rest is read from it.
  const handFirst = path === "choose" && !fromCatalog;
  const gate = handFirst && !handLinkRead;

  // Same pipeline as a pasted link, but the person already chose the category, so detection
  // only fills title, by and photos, and at most shows a one line hint.
  async function readHandLink() {
    if (!ownLinkClean || readingHand) return;
    setReadingHand(true);
    setCategoryHint("");
    try {
      const data = await fetchJson(`/api/fetch-metadata?url=${encodeURIComponent(ownLinkClean)}`, undefined, 15000);
      const found = uniq([data?.image_url, ...((data?.image_urls as string[]) ?? [])]);
      const pageTitle = (typeof data?.title === "string" && data.title) || draft.title;
      const pageBy = (typeof data?.by === "string" && data.by) || draft.by;
      setDraft((d) => ({ ...d, title: pageTitle || d.title, by: pageBy || d.by, image: d.image || found[0] || "" }));
      if (found.length) setPhotos((ps) => uniq([...ps, ...found]));
      const other = categories.find((c) => c.slug === data?.category_slug);
      if (data?.confidence === "high" && other && other.slug !== slug) setCategoryHint(other.label);
      // Same as a pasted link: look it up in this category's catalog straight away.
      if (SEARCHABLE.has(slug) && pageTitle) {
        await lookUp(categoryId, pageTitle, pageBy, typeof data?.year === "number" ? String(data.year) : "", ownLinkClean, found);
      }
    } catch {
      // reading the page is a bonus; the fields stay editable
    } finally {
      setReadingHand(false);
      setHandLinkRead(true);
    }
  }

  function renderOwnLink(first: boolean) {
    return (
      <div className="field">
        <label htmlFor="add-own-link">
          Link <span className="optional">{linkRequired ? "required" : "optional"}</span>
        </label>
        <input
          id="add-own-link"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          required={linkRequired}
          autoFocus={first}
          placeholder="Paste the link visitors should open"
          value={ownLink}
          onChange={(e) => setOwnLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && gate) {
              e.preventDefault();
              readHandLink();
            }
          }}
        />
        <span className="hint">
          {finalUrl
            ? `Visitors will go to ${displayUrl(finalUrl, 60)}`
            : linkRequired
              ? "Needed so visitors can find it. We'll fill in the rest from the page."
              : "A link lets your friends find it. You can also add it without one."}
        </span>
        {!ownLinkClean && linkHelp(slug, draft.title || query).length > 0 && (
          <div className="link-help">
            <span className="hint">Find it on</span>
            <div className="sheet-row">
              {linkHelp(slug, draft.title || query).map((l) => (
                <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn-small">
                  {l.name}
                </a>
              ))}
            </div>
            <span className="hint">Try a page that has pictures, so we can pick one for you.</span>
          </div>
        )}
        {ownLink.trim() && !ownLinkClean && <span className="error">That doesn&apos;t look like a link yet.</span>}
        {ownLink && (
          <button type="button" className="text-btn" style={{ alignSelf: "flex-start" }} onClick={() => setOwnLink("")}>
            Clear
          </button>
        )}
      </div>
    );
  }
  // Honest link rule: what the link field shows is what visitors open. A found place's website
  // is put into that field (editable); for a pasted map link, clearing it goes back to the map.
  const placeSiteField = path === "paste" && slug === "places" && !!catalogSite;
  const finalUrl =
    path === "paste" ? (placeSiteField && ownLinkClean ? stripTracking(ownLinkClean) : link) : ownLinkClean ? stripTracking(ownLinkClean) : "";
  const finalSourceLabel =
    path === "paste" && finalUrl === link ? sourceLabel : finalUrl ? new URL(finalUrl).hostname.replace(/^www\./, "") : "";

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
            {slug === "places"
              ? (draft.placeType || draft.city) && <span className="by">{placeLine(draft.placeType, draft.city)}</span>
              : draft.by && <span className="by">{draft.by}</span>}
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
    start: someday ? SOMEDAY.dialogTitle : "Add a hoshigo",
    link: "Paste a link",
    category: path === "paste" ? "What is this?" : "What are you adding?",
    search: `Find ${category?.label ?? "it"}`,
    details: gate ? "Add its link" : "Check and add",
  }[screen];

  return (
    <>
      {hideStamp ? null : someday ? (
        <button
          type="button"
          className="btn"
          aria-haspopup="dialog"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {SOMEDAY.addOther}
        </button>
      ) : (
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
      )}

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="add-title">
        <h3 id="add-title">{title}</h3>

        {screen === "start" && (
          <div className="choice-list">
            <button type="button" className="choice" onClick={() => setScreen("link")}>
              <strong>Paste a link</strong>
              <span>From Spotify, IMDb, Goodreads, a shop, anywhere. We will try to fill in the rest.</span>
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
                autoCorrect="off"
                enterKeyHint="go"
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  setNotALinkQuery("");
                  setLinkNotice("");
                }}
                autoFocus
              />
              {linkInput && (
                <button
                  type="button"
                  className="text-btn"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    setLinkInput("");
                    setNotALinkQuery("");
                  }}
                >
                  Clear
                </button>
              )}
              <span className="hint">Share text from an app works too.</span>
            </div>
            {linkNotice && (
              <div className="notice" role="status">
                <p>{linkNotice}</p>
              </div>
            )}
            {notALinkQuery && (
              <div className="notice">
                <p>That doesn&apos;t look like a link.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setQuery(notALinkQuery);
                    setPath("choose");
                    setScreen("category");
                  }}
                >
                  Search for “{notALinkQuery.slice(0, 40)}” instead
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
              {changing ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setChanging(false);
                    setScreen("details");
                  }}
                >
                  Back
                </button>
              ) : (
                renderBack(path === "paste" ? "link" : "start")
              )}
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
            {!searching && searchFailed && <p className="hint">Search isn&apos;t answering right now. Try again, or write it in by hand.</p>}
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
            {slug === "games" && (
              <p className="hint">
                A board game that isn&apos;t listed?{" "}
                <button
                  type="button"
                  className="linkish"
                  style={{ padding: 0 }}
                  onClick={() => {
                    setPath("paste");
                    setLinkInput("");
                    setScreen("link");
                  }}
                >
                  Paste its BoardGameGeek link
                </button>
              </p>
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
              if (!someday && !draft.note.trim() && !noteAsked.current) {
                noteAsked.current = true;
                setNoteNudge(true);
                return;
              }
              setNoteNudge(false);
              submittedCategory.current = category ? { label: category.label, slug: category.slug } : null;
              action(fd);
            }}
            className="stack"
            ref={formRef}
          >
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="url" value={finalUrl} />
            <input type="hidden" name="source_label" value={finalUrl ? finalSourceLabel : ""} />
            <input type="hidden" name="work_id" value={workId} />
            <input type="hidden" name="catalog_pick" value={catalogPick} />
            <input type="hidden" name="year" value={workId ? draft.year : ""} />
            <input type="hidden" name="image_url" value={draft.image} />
            <input type="hidden" name="add_path" value={path} />
            <input type="hidden" name="detected_slug" value={detected.slug} />
            <input type="hidden" name="detected_confidence" value={detected.confidence} />
            <input type="hidden" name="detected_reason" value={detected.reason} />
            <input type="hidden" name="changed_by_user" value={changedByUser ? "1" : ""} />

            {readNotice && path === "paste" && <p className="hint">{readNotice}</p>}

            {gate && (
              <p className="cat-line">
                Adding to <strong>{category?.label}</strong>
                {query.trim() && SEARCHABLE.has(slug) && <span> · not found in the catalogue</span>}
              </p>
            )}
            {handFirst && renderOwnLink(gate)}
            {!gate && categoryHint && (
              <p className="hint">
                This page looks like {categoryHint}. It stays in {category?.label} unless you{" "}
                <button type="button" className="linkish" style={{ padding: 0 }} onClick={() => setScreen("category")}>
                  change it
                </button>
                .
              </p>
            )}

            {!gate && (
              <>
            {renderPreview()}

            <p className="cat-line">
              In <strong>{category?.label}</strong>
              {looking && <span> · looking it up…</span>}
              {!looking && matchedSource && <span> · found in {SOURCE_NAME[matchedSource] ?? matchedSource}</span>}
              {!looking && !matchedSource && linkFailed && (
                <span className="error">
                  {" "}
                  · couldn&apos;t link it to {SOURCE_NAME[linkFailed] ?? linkFailed} right now, so it will be added without that link. Try picking it again in a moment.
                </span>
              )}
              {" · "}
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setChanging(path === "paste");
                  setShowAllCategories(true);
                  setScreen("category");
                }}
              >
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
                      <button key={s} type="button" className="chip" onClick={() => chooseCategory(String(c.id), true)}>
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
              {!draft.title && pageTitle && path === "paste" && (
                <button type="button" className="linkish" onClick={() => setDraft((d) => ({ ...d, title: pageTitle }))}>
                  Use the page title: “{pageTitle.length > 50 ? `${pageTitle.slice(0, 49)}…` : pageTitle}”
                </button>
              )}
            </div>
            {slug === "places" ? (
              <>
                <div className="field">
                  <label htmlFor="add-place-type">
                    Type <span className="optional">optional</span>
                  </label>
                  <input
                    id="add-place-type"
                    name="place_type"
                    placeholder="Bar, museum, park…"
                    value={draft.placeType}
                    onChange={(e) => setDraft((d) => ({ ...d, placeType: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="add-city">
                    Location <span className="optional">optional</span>
                  </label>
                  <input
                    id="add-city"
                    name="city"
                    placeholder="City"
                    value={draft.city}
                    onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  />
                  <input type="hidden" name="country" value={draft.country} />
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="add-by">
                  {BY_LABEL[slug] ?? "By"} <span className="optional">optional</span>
                </label>
                <input id="add-by" name="by" value={draft.by} onChange={(e) => setDraft((d) => ({ ...d, by: e.target.value }))} />
              </div>
            )}

            {(
              <div className="field">
                <span className="field-label">Photo</span>
                {visiblePhotos.length > 0 && (!coverLocked || visiblePhotos.length > 1) && (
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
                          rejectOdd
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
                <PhotoFromPage
                  label={visiblePhotos.length ? "Use another photo" : "Add a photo"}
                  allFailed={lastFound.length > 0 && lastFound.every((x) => brokenPhotos.includes(x))}
                  onFound={(imgs) => {
                    setLastFound(imgs);
                    setPhotos((ps) => uniq([...imgs, ...ps]));
                    setBrokenPhotos((b) => b.filter((x) => !imgs.includes(x)));
                    setDraft((d) => ({ ...d, image: imgs[0] }));
                  }}
                />
              </div>
            )}

            {!someday && pins && category && (
              <div className="field">
                <label className="check-row">
                  <input type="checkbox" name="pin" checked={pin} onChange={(e) => setPin(e.target.checked)} />
                  Pin to the top of {category.label}
                </label>
                {pin && pins[category.id] && (
                  <span className="hint">This removes the pin from {pins[category.id].title}.</span>
                )}
              </div>
            )}

            {!someday && (
            <div className="field">
              <label htmlFor="add-note">
                Why five stars? <span className="optional">optional</span>
              </label>
              <textarea
                ref={noteRef}
                id="add-note"
                name="note"
                value={draft.note}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, note: e.target.value }));
                  setNoteNudge(false);
                }}
              />
            </div>
            )}
              </>
            )}

            {placeSiteField ? (
              <>
                {renderOwnLink(false)}
                {finalUrl !== link && (
                  <p className="hint">
                    Found the place&apos;s own website.{" "}
                    <button type="button" className="linkish" style={{ padding: 0 }} onClick={() => setOwnLink("")}>
                      Use the map link you pasted instead
                    </button>
                  </p>
                )}
              </>
            ) : path === "paste" ? (
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
              !handFirst && renderOwnLink(false)
            )}

            {(formError || error) && <p className="error">{formError || error}</p>}
            {noteNudge && !gate && (
              <div className="notice" role="status">
                <p>Are you sure you want to add this without a note? Notes make them more personal.</p>
                <div className="sheet-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setNoteNudge(false);
                      noteRef.current?.focus();
                      noteRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
                    }}
                  >
                    Write a note
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={pending}
                    onClick={() => {
                      setNoteNudge(false);
                      formRef.current?.requestSubmit();
                    }}
                  >
                    Continue without a note
                  </button>
                </div>
              </div>
            )}
            <div className="actions">
              {renderBack(path === "paste" ? "link" : SEARCHABLE.has(slug) ? "search" : "category")}
              {gate ? (
                <button type="button" className="cta" disabled={!ownLinkClean || readingHand} onClick={readHandLink}>
                  {readingHand ? "Reading the link…" : "Continue"}
                </button>
              ) : (
                <button type="submit" className="cta" disabled={pending || !draft.title.trim() || looking || (linkRequired && !finalUrl)}>
                  {someday ? (pending ? SOMEDAY.saving : SOMEDAY.dialogTitle) : pending ? "Adding…" : !finalUrl && !linkRequired ? "Add without a link" : "Add"}
                </button>
              )}
            </div>
          </form>
        )}
      </Sheet>

      {landed && (
        <div className="add-toast" role="status">
          <span>
            Added to your {landed.label}.{" "}
            <Link href={`/${handle}#h-${landed.slug}`} onClick={() => setLanded(null)}>
              See it on your page
            </Link>
          </span>
          <button type="button" className="text-btn" onClick={() => setLanded(null)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
