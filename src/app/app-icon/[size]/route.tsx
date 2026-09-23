import { ImageResponse } from "next/og";

// App icons for the web manifest (Android needs 192 and 512 to offer "install").
// Same red dot as the favicon, on the paper background with room around it.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#efe7d8" }}>
        <div style={{ width: size * 0.56, height: size * 0.56, borderRadius: "50%", background: "#d8321f" }} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } }
  );
}
