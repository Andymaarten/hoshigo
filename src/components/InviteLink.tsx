"use client";

import { useState } from "react";

export default function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const message = `Be my friend on hoshigo: ${url}`;

  return (
    <div className="invite-box">
      <span className="field-label">Your invite link</span>
      <p className="bio" style={{ fontSize: 14 }}>
        Whoever opens it becomes your friend right away, so share it only with people you know.
      </p>
      <code className="invite-url">{url}</code>
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
