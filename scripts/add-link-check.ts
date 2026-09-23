// Checks the /add?url= rule. Usage: npx tsx scripts/add-link-check.ts
import { linkFromAddHref } from "../src/lib/add-link";

const base = "https://www.hoshigo.cc/add";
const cases: [string, string, string | null][] = [
  // [label, href as the browser reports it, expected link]
  ["owner example (browser encodes 星五)", `${base}?url=https://translate.google.com/?sl=ja&tl=nl&text=%E6%98%9F%E4%BA%94&op=translate`, "https://translate.google.com/?sl=ja&tl=nl&text=星五&op=translate"],
  ["owner example, raw text", `${base}?url=https://translate.google.com/?sl=ja&tl=nl&text=星五&op=translate`, "https://translate.google.com/?sl=ja&tl=nl&text=星五&op=translate"],
  ["Spotify with si", `${base}?url=https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc`, "https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc"],
  ["encoded as a whole", `${base}?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2`, "https://example.com/a?b=1&c=2"],
  ["legit %xx inside kept", `${base}?url=https://example.com/a%20b?q=x%26y`, "https://example.com/a%20b?q=x%26y"],
  ["#fragment kept", `${base}?url=https://example.com/page#section-2`, "https://example.com/page#section-2"],
  ["url= missing", `${base}`, null],
  ["url= empty", `${base}?url=`, ""],
  ["other params before", `${base}?ref=x&url=https://a.com/?b=1&c=2`, "https://a.com/?b=1&c=2"],
  ["curl= is not url=", `${base}?curl=x&url=https://a.com`, "https://a.com"],
  ["share target, link in text", `${base}?title=Hey&text=Check+this+https%3A%2F%2Fa.com%2Fx&url=`, "Check this https://a.com/x"],
  ["share target, url set", `${base}?title=Hey&text=&url=https%3A%2F%2Fa.com%2Fx%3Fy%3D1`, "https://a.com/x?y=1"],
  ["plain text", `${base}?url=Spirited Away`, "Spirited Away"],
  ["plain text as the browser reports it", `${base}?url=Spirited%20Away`, "Spirited Away"],
  ["bare domain, no scheme", `${base}?url=open.spotify.com/album/x?si=1`, "open.spotify.com/album/x?si=1"],
];
let fail = 0;
for (const [label, href, want] of cases) {
  const got = linkFromAddHref(href);
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", label, "→", JSON.stringify(got));
}
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
