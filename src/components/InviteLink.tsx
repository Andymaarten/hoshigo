"use client";

import { useState } from "react";

export default function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const message = `Be my friend on hoshigo: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="invite-box">
      <span className="field-label">Your invite link</span>
      <p className="bio" style={{ fontSize: 14 }}>
        Whoever opens it becomes your friend right away, so share it only with people you know.
      </p>
      <button type="button" className="invite-url" onClick={copy} aria-label="Copy your invite link">
        <code>{url}</code>
        {copied && <span className="invite-copied">Copied</span>}
      </button>
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={copy}
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
