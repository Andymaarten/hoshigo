// Round 13 (B1): every IMDb link shape someone might paste.
// Usage: npx tsx --env-file=.env.local scripts/imdb-check.ts
import { readLink } from "../src/lib/read-link";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];

// [input, expected category or "unsupported", expected title fragment]
const cases: [string, string, string][] = [
  ["https://www.imdb.com/title/tt0111161/", "films", "Shawshank"],
  ["https://www.imdb.com/title/tt0111161/?ref_=nv_sr_srsg_0", "films", "Shawshank"],
  ["https://m.imdb.com/title/tt0111161/", "films", "Shawshank"],
  ["https://m.imdb.com/title/tt0111161/?ref_=m_ft_dsc", "films", "Shawshank"],
  ["https://www.imdb.com/title/tt0111161/reference", "films", "Shawshank"],
  ["https://www.imdb.com/title/tt0111161/reference/?ref_=tt_ov", "films", "Shawshank"],
  ["https://www.imdb.com/title/tt0111161", "films", "Shawshank"],
  ["imdb.com/title/tt0111161", "films", "Shawshank"],
  ["Check out The Shawshank Redemption on IMDb: https://www.imdb.com/title/tt0111161/?ref_=ext_shr_lnk", "films", "Shawshank"],
  ["Check out \"Breaking Bad\" on IMDb:\nhttps://m.imdb.com/title/tt0903747/", "tv", "Breaking Bad"],
  // A made up short link: imdb.to answers 404, which must read as a broken link.
  ["https://imdb.to/3xYzAbC", "error", ""],
  ["https://www.imdb.com/title/tt13406094/", "tv", "White Lotus"],
  ["https://www.imdb.com/name/nm0000151/", "unsupported", ""],
  ["https://www.imdb.com/list/ls055592025/", "unsupported", ""],
  ["https://www.imdb.com/title/tt0959621/", "tv", "Pilot"],
  ["https://www.imdb.de/title/tt0111161/", "films", "Shawshank"],
  ["https://www.imdb.com/fr/title/tt0111161/", "films", "Shawshank"],
  ["https://www.imdb.com/title/tt0111161/  \n", "films", "Shawshank"],
  ["  https://www.imdb.com/title/tt0111161/?ref_=fn_al_tt_1\n\n", "films", "Shawshank"],
];

async function main() {
  let failed = 0;
  for (const [input, want, title] of cases) {
    const r = await readLink(input, SLUGS, { useLlm: false });
    let ok: boolean;
    if (want === "unsupported") ok = r.status === "unsupported" && !!r.notice;
    else if (want === "error") ok = r.status === "error";
    else ok = r.status === "ok" && r.category_slug === want && (r.title ?? "").includes(title);
    if (!ok) failed++;
    console.log(`${ok ? "OK  " : "FAIL"} ${JSON.stringify(input).slice(0, 70)} → ${r.status} ${r.category_slug ?? ""} "${r.title ?? ""}" ${r.reason ?? r.notice ?? ""}`);
  }
  console.log(failed ? `${failed} failed` : "all passed");
}
main().then(() => process.exit(0));
