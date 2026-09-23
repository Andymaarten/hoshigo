import Anthropic from "@anthropic-ai/sdk";

// Layered category classifier for a pasted link, cheapest and most certain signal first:
// 1. known domains / URL path shapes, 2. structured data on the page (JSON-LD, og:type),
// 3. an LLM fallback only when the first two leave it unclear. See docs/sources.md.

export type Confidence = "high" | "medium" | "low";
export type Classification = {
  slug: string;
  confidence: Confidence;
  reason: string;
  alternatives: string[];
};

export type PageSignals = {
  url: string;
  hostname: string;
  path: string;
  siteName?: string | null;
  title?: string | null;
  description?: string | null;
  ogType?: string | null;
  generator?: string | null;
  jsonLdTypes?: string[];
  visibleText?: string | null;
};

type Rule = [RegExp, string, string?];

const DOMAIN_RULES: Rule[] = [
  [/(^|\.)letterboxd\.com$/, "films"],
  [/(^|\.)imdb\.com$/, "films"],
  [/(^|\.)rottentomatoes\.com$/, "films"],
  [/(^|\.)mubi\.com$/, "films"],
  [/(^|\.)open\.spotify\.com$/, "albums"],
  [/(^|\.)music\.apple\.com$/, "albums"],
  [/(^|\.)bandcamp\.com$/, "albums"],
  [/(^|\.)discogs\.com$/, "albums"],
  [/(^|\.)musicbrainz\.org$/, "albums"],
  [/(^|\.)allmusic\.com$/, "albums"],
  [/(^|\.)rateyourmusic\.com$/, "albums"],
  [/(^|\.)tidal\.com$/, "albums"],
  [/(^|\.)deezer\.com$/, "albums"],
  [/(^|\.)music\.youtube\.com$/, "songs"],
  [/(^|\.)soundcloud\.com$/, "songs"],
  [/(^|\.)goodreads\.com$/, "books"],
  [/(^|\.)openlibrary\.org$/, "books"],
  [/(^|\.)books\.google\.[a-z.]+$/, "books"],
  [/(^|\.)storygraph\.com$/, "books"],
  [/(^|\.)podcasts\.apple\.com$/, "podcasts"],
  [/(^|\.)pocketcasts\.com$/, "podcasts"],
  [/(^|\.)overcast\.fm$/, "podcasts"],
  [/(^|\.)podcasts\.google\.com$/, "podcasts"],
  [/(^|\.)youtube\.com$/, "videos"],
  [/(^|\.)youtu\.be$/, "videos"],
  [/(^|\.)vimeo\.com$/, "videos"],
  [/(^|\.)maps\.google\.[a-z.]+$/, "places"],
  [/(^|\.)maps\.app\.goo\.gl$/, "places"],
  [/(^|\.)maps\.apple\.com$/, "places"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "places"],
  [/(^|\.)openstreetmap\.org$/, "places"],
  [/(^|\.)substack\.com$/, "essays"],
  [/(^|\.)medium\.com$/, "essays"],
  [/(^|\.)store\.steampowered\.com$/, "games"],
  [/(^|\.)igdb\.com$/, "games"],
  [/(^|\.)boardgamegeek\.com$/, "games"],
  [/(^|\.)itch\.io$/, "games"],
];

function ruleFromUrl(hostname: string, path: string, url = ""): { slug: string; reason: string } | null {
  const host = hostname.toLowerCase();
  const tag = host.replace(/^www\./, "");
  if (/(^|\.)themoviedb\.org$/.test(host)) return { slug: path.startsWith("/tv/") ? "tv" : "films", reason: "domain: themoviedb" };
  if (/(^|\.)imdb\.com$/.test(host) && /\/title\//.test(path)) return { slug: "films", reason: "domain: imdb" };
  if (/(^|\.)justwatch\.com$/.test(host)) return { slug: /\/tv-show\//.test(path) ? "tv" : "films", reason: "domain: justwatch" };
  if (/(^|\.)letterboxd\.com$/.test(host)) return { slug: "films", reason: "domain: letterboxd" };
  if (/(^|\.)open\.spotify\.com$/.test(host)) {
    if (/\/track\//.test(path)) return { slug: "songs", reason: "path: spotify track" };
    if (/\/(episode|show)\//.test(path)) return { slug: "podcasts", reason: "path: spotify podcast" };
    return { slug: "albums", reason: "path: spotify album" };
  }
  if (/(^|\.)music\.apple\.com$/.test(host)) {
    if (/\/song\//.test(path) || /[?&]i=\d+/.test(url)) return { slug: "songs", reason: "path: apple music song" };
    return { slug: "albums", reason: "domain: apple music" };
  }
  if (/(^|\.)bandcamp\.com$/.test(host)) return { slug: /\/track\//.test(path) ? "songs" : "albums", reason: "domain: bandcamp" };
  if (/(^|\.)google\.[a-z.]+$/.test(host) && /^\/maps\b/.test(path)) return { slug: "places", reason: "path: google maps" };
  if (/(^|\.)goo\.gl$/.test(host) && /^\/maps\b/.test(path)) return { slug: "places", reason: "path: google maps" };
  if (/(^|\.)instagram\.com$/.test(host) && /^\/explore\/locations\//.test(path)) return { slug: "places", reason: "path: instagram location" };
  // Amazon ASINs for printed books are their ISBN10, so an all digit /dp/ id is a book.
  if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
    const asin = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
    if (asin && /^\d{9}[\dX]$/i.test(asin)) return { slug: "books", reason: "path: amazon isbn" };
    if (/[-/](ebook|kindle)[-/]/i.test(path)) return { slug: "books", reason: "path: amazon ebook" };
  }
  if (/(^|\.)bol\.com$/.test(host) && /\/97[89]\d{10}(\/|$)/.test(path))
    return { slug: "books", reason: "path: bol isbn" };
  for (const [re, slug] of DOMAIN_RULES) if (re.test(host)) return { slug, reason: `domain: ${tag}` };
  return null;
}

const JSONLD_TYPE_MAP: [RegExp, string, Confidence][] = [
  [/^(Movie)$/, "films", "high"],
  [/^(TVSeries|TVSeason|TVEpisode)$/, "tv", "high"],
  [/^(MusicAlbum|MusicRelease)$/, "albums", "high"],
  [/^(MusicRecording)$/, "songs", "high"],
  [/^(Book|Audiobook)$/, "books", "high"],
  [/^(PodcastSeries|PodcastEpisode)$/, "podcasts", "high"],
  [/^(VideoGame|VideoGameSeries)$/, "games", "high"],
  [
    /^(Place|LocalBusiness|Restaurant|FoodEstablishment|CafeOrCoffeeShop|BarOrPub|Bakery|TouristAttraction|Museum|Park|LodgingBusiness|Hotel|LandmarksOrHistoricalBuildings|CivicStructure|Store)$/,
    "places",
    "high",
  ],
  [/^(VideoObject)$/, "videos", "medium"],
  [/^(Recipe)$/, "things", "medium"],
  [/^(Product|ProductGroup|IndividualProduct)$/, "things", "medium"],
  [/^(Article|NewsArticle|BlogPosting|Report|ScholarlyArticle|OpinionNewsArticle|AnalysisNewsArticle|ReviewNewsArticle|Essay)$/, "essays", "medium"],
];

const OG_TYPE_MAP: [RegExp, string, Confidence][] = [
  [/^video\.(tv_show|episode)/, "tv", "high"],
  [/^video\.movie/, "films", "high"],
  [/^video\./, "videos", "medium"],
  [/^music\.song/, "songs", "high"],
  [/^music\.(album|playlist)/, "albums", "high"],
  [/^books?(\.|$)/, "books", "high"],
  [/^article/, "essays", "medium"],
  [/^(product|og:product)/, "things", "medium"],
  [/^(restaurant|place|business\.business)/, "places", "high"],
];

// Pulls every @type out of every JSON-LD block, including @graph arrays and nested
// mainEntity objects, since sites wrap the interesting node in a WebPage more often than not.
export function jsonLdTypes(html: string): { types: string[]; nodes: Record<string, unknown>[] } {
  const types: string[] = [];
  const nodes: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    const o = v as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string" || Array.isArray(t)) {
      for (const one of [t].flat()) if (typeof one === "string") types.push(one.replace(/^https?:\/\/schema\.org\//, ""));
      nodes.push(o);
    }
    for (const key of ["@graph", "mainEntity", "itemReviewed", "workExample"]) if (o[key]) visit(o[key], depth + 1);
  };
  for (const m of html.matchAll(re)) {
    try {
      visit(JSON.parse(m[1].trim()), 0);
    } catch {
      // malformed JSON-LD is common enough to ignore silently
    }
  }
  return { types, nodes };
}

function fromJsonLd(types: string[]): { slug: string; confidence: Confidence; type: string } | null {
  let best: { slug: string; confidence: Confidence; type: string } | null = null;
  for (const t of types) {
    for (const [re, slug, confidence] of JSONLD_TYPE_MAP) {
      if (!re.test(t)) continue;
      if (!best || (best.confidence !== "high" && confidence === "high")) best = { slug, confidence, type: t };
    }
  }
  return best;
}

const llmCache = new Map<string, { slug: string; confidence: Confidence; alternatives: string[] } | null>();
const LLM_MODEL = "claude-haiku-4-5-20251001";

async function llmClassify(
  signals: PageSignals,
  slugs: string[]
): Promise<{ slug: string; confidence: Confidence; alternatives: string[] } | null> {
  if (!process.env.ANTHROPIC_API_KEY || !slugs.length) return null;
  const key = `${signals.hostname}${signals.path}`;
  if (llmCache.has(key)) return llmCache.get(key) ?? null;

  const input = [
    `URL: ${signals.url}`,
    signals.siteName && `Site: ${signals.siteName}`,
    signals.title && `Title: ${signals.title}`,
    signals.description && `Description: ${signals.description.slice(0, 300)}`,
    signals.ogType && `og:type: ${signals.ogType}`,
    signals.jsonLdTypes?.length && `schema.org types: ${signals.jsonLdTypes.slice(0, 8).join(", ")}`,
    signals.visibleText && `Page text: ${signals.visibleText.slice(0, 500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({ timeout: 5000, maxRetries: 0 });
    const res = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: 200,
      system:
        "You sort links people want to recommend into one category of a personal favourites list. Pick the category for the thing the page is about (the film, album, book, place, product...), not the kind of website. A review of a film is films; a shop page for a book is books; a news or blog post is essays.",
      tools: [
        {
          name: "categorize",
          description: "Record the category of the linked thing.",
          strict: true,
          input_schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: slugs },
              runner_up: { type: "string", enum: slugs },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["category", "runner_up", "confidence"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "categorize" },
      messages: [{ role: "user", content: input }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("no tool call");
    const out = block.input as { category?: string; runner_up?: string; confidence?: Confidence };
    if (!out.category || !slugs.includes(out.category)) throw new Error("bad category");
    const result = {
      slug: out.category,
      confidence: (["high", "medium", "low"].includes(out.confidence ?? "") ? out.confidence : "low") as Confidence,
      alternatives: [out.category, out.runner_up].filter((s): s is string => !!s && slugs.includes(s)),
    };
    llmCache.set(key, result);
    if (llmCache.size > 500) llmCache.delete(llmCache.keys().next().value!);
    return result;
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.warn("classify llm failed", err.status);
    return null;
  }
}

function uniq(list: string[]) {
  return [...new Set(list)];
}

export async function classify(
  signals: PageSignals,
  slugs: string[],
  opts: { useLlm?: boolean } = {}
): Promise<Classification> {
  const known = (s: string) => slugs.length === 0 || slugs.includes(s);
  const rule = ruleFromUrl(signals.hostname, signals.path, signals.url);
  if (rule && known(rule.slug)) return { ...rule, confidence: "high", alternatives: [rule.slug] };

  const ld = fromJsonLd(signals.jsonLdTypes ?? []);
  if (ld && ld.confidence === "high" && known(ld.slug))
    return { slug: ld.slug, confidence: "high", reason: `json-ld: ${ld.type}`, alternatives: [ld.slug] };

  let og: { slug: string; confidence: Confidence } | null = null;
  if (signals.ogType) for (const [re, slug, confidence] of OG_TYPE_MAP) if (re.test(signals.ogType)) { og = { slug, confidence }; break; }
  if (og && og.confidence === "high" && known(og.slug))
    return { slug: og.slug, confidence: "high", reason: `og:type: ${signals.ogType}`, alternatives: [og.slug] };
  if (!og && signals.generator && /^bandcamp$/i.test(signals.generator))
    return { slug: "albums", confidence: "high", reason: "generator: bandcamp", alternatives: ["albums"] };

  const weak = ld ?? og;
  const weakReason = ld ? `json-ld: ${ld.type}` : og ? `og:type: ${signals.ogType}` : null;

  if (opts.useLlm !== false) {
    const llm = await llmClassify(signals, slugs);
    if (llm) {
      const alternatives = uniq([...llm.alternatives, ...(weak ? [weak.slug] : [])]).slice(0, 3);
      return { slug: llm.slug, confidence: llm.confidence, reason: weakReason ? `llm (${weakReason})` : "llm", alternatives };
    }
  }

  if (weak && known(weak.slug)) {
    const alternatives = uniq([weak.slug, ...(weak.slug === "essays" ? ["things"] : ["essays"])]).filter(known);
    return { slug: weak.slug, confidence: "medium", reason: weakReason!, alternatives };
  }
  return { slug: "things", confidence: "low", reason: "no signal", alternatives: ["things", "essays"].filter(known) };
}
