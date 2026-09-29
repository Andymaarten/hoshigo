"use client";

import { track } from "@vercel/analytics";
import { openLinkLabel, type OpenLink } from "@/lib/platforms";

// The viewer's preferred platform for this thing, next to (never instead of) the listing's own link.
export default function OpenIn({ link }: { link: OpenLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener"
      className="btn btn-small"
      onClick={() => track("open_in", { platform: link.platform, kind: link.kind })}
    >
      {openLinkLabel(link)}
    </a>
  );
}
