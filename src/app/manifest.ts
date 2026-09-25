import type { MetadataRoute } from "next";

// Installing hoshigo on Android puts it in the system share sheet ("share to hoshigo");
// shared links arrive at /add?title=…&text=…&url=… (url last, see src/lib/add-link.ts).
// iOS doesn't support share_target; docs/add-link.md has a Shortcut and a bookmarklet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "hoshigo",
    short_name: "hoshigo",
    description: "A small list of things you'd give five stars.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#efe7d8",
    theme_color: "#efe7d8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
