import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { safeFetch } from "@/lib/safe-fetch";
import { excerpt, SHARE_FORMATS, type ShareFormat, type SharedListing } from "@/lib/share";

const GROUND = "#efe7d8";
const INK = "#1d1c1a";
const MUTED = "#5b574f";
const ACCENT = "#d8321f";
const PLACEHOLDER = "#e3dac9";
const RULE = "rgba(29, 28, 26, 0.22)";

const fontDir = join(process.cwd(), "assets/fonts");
const fontsPromise = Promise.all([
  readFile(join(fontDir, "Newsreader-Regular.ttf")),
  readFile(join(fontDir, "Newsreader-Italic.ttf")),
  readFile(join(fontDir, "SchibstedGrotesk-Bold.ttf")),
  readFile(join(fontDir, "ShipporiMincho-Bold-subset.ttf")),
]).then(([serif, serifItalic, display, mincho]) => [
  { name: "Newsreader", data: serif, weight: 400 as const, style: "normal" as const },
  { name: "Newsreader", data: serifItalic, weight: 400 as const, style: "italic" as const },
  { name: "Schibsted Grotesk", data: display, weight: 700 as const, style: "normal" as const },
  { name: "Shippori Mincho", data: mincho, weight: 700 as const, style: "normal" as const },
]);

type Cover = { src: string; width: number; height: number };

const MAX_COVER_BYTES = 6 * 1024 * 1024;

// Satori needs the pixel size up front and only decodes PNG and JPEG, so read both from the header.
function imageSize(buf: Uint8Array): { type: "png" | "jpeg"; width: number; height: number } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const v = new DataView(buf.buffer, buf.byteOffset);
    return { type: "png", width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpeg", height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

// WebP and AVIF covers (common on shop and brand sites) get converted with sharp, which ships
// with Next as an optional dependency; if it isn't installed the card uses the placeholder.
async function toPng(buf: Uint8Array): Promise<Uint8Array | null> {
  try {
    const sharp = (await import("sharp")).default;
    return new Uint8Array(await sharp(buf).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png().toBuffer());
  } catch {
    return null;
  }
}

function largerVariant(url: string): string {
  return url
    .replace(/^http:/, "https:")
    .replace(/(image\.tmdb\.org\/t\/p\/)(original|w\d+)\//, "$1w780/")
    .replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1")
    .replace(/(coverartarchive\.org\/release-group\/[^/]+\/front)(-\d+)?$/, "$1-500");
}

export async function loadCover(url: string | null | undefined): Promise<Cover | null> {
  if (!url) return null;
  try {
    const res = await safeFetch(largerVariant(url), {
      // Cover Art Archive redirects into archive.org storage and can take 8s cold.
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "image/jpeg,image/png;q=0.9,*/*;q=0.5" },
    });
    if (!res.ok) return null;
    let buf: Uint8Array = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_COVER_BYTES) return null;
    let info = imageSize(buf);
    if (!info) {
      buf = (await toPng(buf)) ?? buf;
      info = imageSize(buf);
    }
    if (!info || info.width < 40 || info.height < 40) return null;
    const src = `data:image/${info.type};base64,${Buffer.from(buf).toString("base64")}`;
    return { src, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

function fit(cover: Cover, maxW: number, maxH: number) {
  const scale = Math.min(maxW / cover.width, maxH / cover.height);
  return { width: Math.round(cover.width * scale), height: Math.round(cover.height * scale) };
}

function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", fontFamily: "Newsreader", fontSize: size, lineHeight: 1, color: INK }}>
      <span>hosh</span>
      <span style={{ display: "flex", position: "relative" }}>
        ı
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: size * 0.03,
            width: size * 0.15,
            height: size * 0.15,
            marginLeft: -size * 0.075,
            borderRadius: size,
            background: ACCENT,
          }}
        />
      </span>
      <span>go</span>
    </div>
  );
}

function CoverBlock({ cover, maxW, maxH, title }: { cover: Cover | null; maxW: number; maxH: number; title: string }) {
  if (cover) {
    const { width, height } = fit(cover, maxW, maxH);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover.src}
        width={width}
        height={height}
        alt=""
        style={{ width, height, objectFit: "cover", boxShadow: "0 18px 40px rgba(29,28,26,0.28)" }}
      />
    );
  }
  // Same calm placeholder as the site's thumbs when a cover is missing or its host fails.
  const w = Math.min(maxW, maxH * 0.7);
  return (
    <div
      style={{
        width: w,
        height: w / 0.7,
        maxHeight: maxH,
        background: PLACEHOLDER,
        border: `1px solid ${RULE}`,
        color: MUTED,
        display: "flex",
        alignItems: "flex-end",
        padding: w * 0.09,
        fontFamily: "Newsreader",
        fontStyle: "italic",
        fontSize: w * 0.11,
        lineHeight: 1.1,
      }}
    >
      {excerpt(title, 60)}
    </div>
  );
}

function Brand({ handle, size, stacked }: { handle: string; size: number; stacked?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "center" : "flex-end", gap: size * 0.4 }}>
      <Wordmark size={size} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: stacked ? "center" : "flex-start", fontFamily: "Newsreader", fontSize: size * 0.42, color: MUTED, lineHeight: 1.25 }}>
        <div style={{ display: "flex", alignItems: "center", gap: size * 0.18 }}>
          <span style={{ fontFamily: "Shippori Mincho", color: INK }}>星五</span>
          <span style={{ fontStyle: "italic" }}>Japanese for five stars</span>
        </div>
        <span>hoshigo.cc/{handle}</span>
      </div>
    </div>
  );
}

function Kicker({ listing, size }: { listing: SharedListing; size: number }) {
  const name = listing.profile.display_name || listing.profile.handle;
  return (
    <div style={{ display: "flex", fontFamily: "Schibsted Grotesk", fontWeight: 700, fontSize: size, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT }}>
      {`One of ${name}’s five stars`}
    </div>
  );
}

export async function renderShareCard(listing: SharedListing, format: ShareFormat, cover: Cover | null) {
  const { width, height } = SHARE_FORMATS[format];
  const { item, profile } = listing;
  const byline = [item.by, item.year].filter(Boolean).join(", ");
  const fonts = await fontsPromise;

  let body: React.ReactElement;
  if (format === "og") {
    const note = excerpt(item.note, 150);
    body = (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 56, gap: 56, alignItems: "center" }}>
        <div style={{ display: "flex", width: 420, height: 518, alignItems: "center", justifyContent: "center" }}>
          <CoverBlock cover={cover} maxW={420} maxH={518} title={item.title} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Kicker listing={listing} size={20} />
            <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: item.title.length > 40 ? 50 : 62, lineHeight: 1.05, color: INK }}>
              {excerpt(item.title, 80)}
            </div>
            {byline && <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 28, color: MUTED }}>{excerpt(byline, 70)}</div>}
            {note && (
              <div style={{ display: "flex", marginTop: 14, fontFamily: "Newsreader", fontStyle: "italic", fontSize: 29, lineHeight: 1.3, color: INK }}>
                {`“${note}”`}
              </div>
            )}
          </div>
          <Brand handle={profile.handle} size={46} />
        </div>
      </div>
    );
  } else {
    const story = format === "story";
    const note = excerpt(item.note, story ? 220 : 150);
    const coverMaxH = story ? 940 : 640;
    body = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          height: "100%",
          padding: story ? "150px 90px 130px" : "80px 90px 70px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: story ? 50 : 34 }}>
          <div style={{ display: "flex", height: coverMaxH, alignItems: "center", justifyContent: "center" }}>
            <CoverBlock cover={cover} maxW={story ? 820 : 760} maxH={coverMaxH} title={item.title} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 880 }}>
            <Kicker listing={listing} size={story ? 26 : 22} />
            <div style={{ display: "flex", textAlign: "center", fontFamily: "Newsreader", fontSize: item.title.length > 40 ? 52 : 66, lineHeight: 1.05, color: INK }}>
              {excerpt(item.title, 80)}
            </div>
            {byline && <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 32, color: MUTED }}>{excerpt(byline, 60)}</div>}
            {note && (
              <div style={{ display: "flex", textAlign: "center", marginTop: 16, fontFamily: "Newsreader", fontStyle: "italic", fontSize: story ? 38 : 32, lineHeight: 1.3, color: INK }}>
                {`“${note}”`}
              </div>
            )}
          </div>
        </div>
        <Brand handle={profile.handle} size={story ? 64 : 52} stacked />
      </div>
    );
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: GROUND, color: INK, position: "relative" }}>
        {body}
      </div>
    ),
    {
      width,
      height,
      fonts,
      // A day on the CDN makes a repeat share instant; an edited note shows up within the hour.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
