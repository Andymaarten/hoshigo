import type { MetadataRoute } from "next";

// Installing hoshigo on Android puts it in the system share sheet ("share to hoshigo");
// shared links arrive at /add?title=…&text=…&url=… (url last, see src/lib/add-link.ts).
// iOS doesn't support share_target; docs/add-link.md has a Shortcut and a bookmarklet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hoshigo",
    short_name: "hoshigo",
    description: "A small list of things you'd give five stars.",
    start_url: "/",
    display: "standalone",
    background_color: "#efe7d8",
    theme_color: "#efe7d8",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
    ],
    share_target: {
      action: "/add",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
