// Small keyless Wikidata client. Used for games (video and board games) and as a bridge
// when another catalog doesn't know a translated title (Wikidata has labels and aliases in
// many languages plus other catalogs' ids, e.g. P4947 = TMDB movie id).

const WM_HEADERS = { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" };
const API = "https://www.wikidata.org/w/api.php";

type Snak = { datavalue?: { value?: unknown } };
type Claim = { mainsnak?: Snak; rank?: string };
export type WdEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
};

async function wd(params: Record<string, string>) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, {
    headers: WM_HEADERS,
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return null;
  return res.json();
}

// Label and alias search in several languages at once, so a Dutch or German title finds
// the same item as the English one. Returns item ids in relevance order, deduped.
export async function searchItems(query: string, languages = ["en", "nl", "de", "fr"], limit = 12): Promise<string[]> {
  const lists = await Promise.all(
    languages.map((language) =>
      wd({ action: "wbsearchentities", search: query, language, uselang: language, type: "item", limit: String(limit) })
        .then((d) => ((d?.search ?? []) as { id: string }[]).map((s) => s.id))
        .catch(() => [] as string[])
    )
  );
  const out: string[] = [];
  for (let i = 0; i < limit; i++) for (const l of lists) if (l[i] && !out.includes(l[i])) out.push(l[i]);
  return out;
}

export async function getEntities(ids: string[], props = "labels|descriptions|claims"): Promise<Record<string, WdEntity>> {
  const out: Record<string, WdEntity> = {};
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    if (!chunk.length) continue;
    const d = await wd({ action: "wbgetentities", ids: chunk.join("|"), props, languages: "en|nl|de|fr|ja|mul" }).catch(() => null);
    Object.assign(out, d?.entities ?? {});
  }
  return out;
}

// Finds the item that carries a statement, e.g. Steam app id P1733=620.
export async function itemByStatement(prop: string, value: string): Promise<string | null> {
  const d = await wd({ action: "query", list: "search", srsearch: `haswbstatement:${prop}=${value}`, srlimit: "1" }).catch(() => null);
  return d?.query?.search?.[0]?.title ?? null;
}

export function label(e: WdEntity | undefined, prefer = ["en", "mul", "nl", "de", "fr"]): string | null {
  if (!e?.labels) return null;
  for (const l of prefer) if (e.labels[l]) return e.labels[l].value;
  return Object.values(e.labels)[0]?.value ?? null;
}

export function claimIds(e: WdEntity | undefined, prop: string): string[] {
  return (e?.claims?.[prop] ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((s): s is string => !!s);
}

export function claimString(e: WdEntity | undefined, prop: string): string | null {
  const v = e?.claims?.[prop]?.find((c) => c.rank !== "deprecated")?.mainsnak?.datavalue?.value;
  return typeof v === "string" ? v : null;
}

export function claimYear(e: WdEntity | undefined, prop = "P577"): number | null {
  const years = (e?.claims?.[prop] ?? [])
    .map((c) => (c.mainsnak?.datavalue?.value as { time?: string } | undefined)?.time?.match(/^[+-](\d{4})/)?.[1])
    .filter(Boolean)
    .map(Number);
  return years.length ? Math.min(...years) : null;
}

// A Commons file name to a small, directly loadable image URL.
export function commonsImage(file: string | null, width = 400): string | null {
  return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}` : null;
}
