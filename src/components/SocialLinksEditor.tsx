"use client";

import { useId, useState } from "react";
import type { SocialLink } from "@/lib/supabase/types";
import { SOCIAL_PLATFORMS } from "@/lib/social-links";

type Row = { platform: string; handle: string };

export default function SocialLinksEditor({
  name = "social_links",
  initialLinks = [],
}: {
  name?: string;
  initialLinks?: SocialLink[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialLinks.length ? initialLinks.map((l) => ({ platform: l.platform, handle: l.handle })) : []
  );
  const legendId = useId();

  function addRow() {
    if (rows.length >= 6) return;
    setRows([...rows, { platform: SOCIAL_PLATFORMS[0].id, handle: "" }]);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div role="group" aria-labelledby={legendId} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span id={legendId} className="field" style={{ display: "block" }}>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--muted)" }}>
          Other accounts
        </span>
      </span>

      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 140 }}>
            <label htmlFor={`social-platform-${i}`}>Platform</label>
            <select
              id={`social-platform-${i}`}
              value={row.platform}
              onChange={(e) => updateRow(i, { platform: e.target.value })}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor={`social-handle-${i}`}>{row.platform === "website" ? "URL" : "Handle"}</label>
            <input
              id={`social-handle-${i}`}
              value={row.handle}
              onChange={(e) => updateRow(i, { handle: e.target.value })}
              placeholder={row.platform === "website" ? "yoursite.com" : "yourhandle"}
            />
          </div>
          <div className="field">
            <label htmlFor={`social-remove-${i}`} aria-hidden style={{ visibility: "hidden" }}>
              Remove
            </label>
            <button
              id={`social-remove-${i}`}
              type="button"
              className="btn"
              onClick={() => removeRow(i)}
              aria-label={`Remove ${row.platform || "link"} entry`}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {rows.length < 6 && (
        <button type="button" className="btn" onClick={addRow} style={{ alignSelf: "flex-start" }}>
          + Add account
        </button>
      )}

      <input
        type="hidden"
        name={name}
        value={JSON.stringify(rows.filter((r) => r.handle.trim()))}
        readOnly
      />
    </div>
  );
}
