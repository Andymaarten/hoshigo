// Checks that readLink() refuses internal addresses. Usage: npx tsx scripts/ssrf-check.ts
import { readLink } from "../src/lib/read-link";
import { assertPublicUrl, safeFetch } from "../src/lib/safe-fetch";

async function main() {
  const bad = [
    "http://localhost:3197/",
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://172.20.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0.0.0.0/",
    "http://metadata.google.internal/",
    "http://localtest.me/",
    "ftp://example.com/",
    "http://user:pw@example.com/",
  ];
  for (const u of bad) {
    const blocked = await assertPublicUrl(u).then(() => false, () => true);
    console.log(blocked ? "BLOCKED" : "ALLOWED", u);
  }
  // A public redirector that points at 127.0.0.1 must be refused at the hop.
  const hop = await safeFetch("https://httpbin.org/redirect-to?url=http%3A%2F%2F127.0.0.1%2F").then(
    (r) => `ALLOWED (${r.status})`,
    (e) => `BLOCKED at hop (${e.message})`
  );
  console.log(hop, "httpbin redirect to 127.0.0.1");
  const r = await readLink("http://169.254.169.254/latest/meta-data/", []);
  console.log("readLink metadata IP →", r.status, r.reason);
  const ok = await readLink("https://www.imdb.com/title/tt0110912/", ["films", "tv"]);
  console.log("readLink public IMDb →", ok.status, ok.title);
}

main().then(() => process.exit(0));
