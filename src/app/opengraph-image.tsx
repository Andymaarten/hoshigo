import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { fontsPromise, Wordmark } from "@/lib/share-card";

export const alt = "hoshigo, Japanese for five stars";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const hero = (name: string) =>
  readFile(join(process.cwd(), "public/hero", name)).then((b) => `data:image/png;base64,${b.toString("base64")}`);

// WhatsApp often crops the preview to a square around the centre, so everything that
// matters sits in the middle 630px; the painted strokes only live in the side bands.
export default async function Image() {
  const [fonts, lines, dots] = await Promise.all([
    fontsPromise,
    Promise.all(["bluelines_2.png", "bluelines_5.png", "bluelines_8.png", "bluelines_11.png"].map(hero)),
    Promise.all(["redhoshigos_1.png", "redhoshigos_3.png"].map(hero)),
  ]);

  const band = (strokes: string[], dot: string, flip: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 26, width: 250, justifyContent: "center", flexDirection: flip ? "row-reverse" : "row" }}>
      {strokes.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" width={50} height={360} style={{ width: 50, height: 360, marginTop: i % 2 ? 60 : -40, opacity: 0.9 }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dot} alt="" width={90} height={93} style={{ width: 90, height: 93, marginTop: flip ? -160 : 180 }} />
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#efe7d8", alignItems: "center", justifyContent: "space-between", padding: "0 30px" }}>
        {band(lines.slice(0, 2), dots[0], false)}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <Wordmark size={160} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Newsreader", fontSize: 40, color: "#1d1c1a" }}>
            <span style={{ fontFamily: "Shippori Mincho" }}>星五</span>
            <span style={{ fontStyle: "italic" }}>Japanese for five stars</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 32, color: "#5b574f", marginTop: 6 }}>hoshigo.cc</div>
        </div>
        {band(lines.slice(2), dots[1], true)}
      </div>
    ),
    { ...size, fonts }
  );
}
