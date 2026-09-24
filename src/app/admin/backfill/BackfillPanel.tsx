"use client";

import { useState } from "react";

type Result = {
  item_id: string;
  category: string;
  title: string;
  by: string | null;
  match: { source: string; source_id: string; title: string; by: string | null; confidence: string } | null;
  action: string;
};
type Mismatch = { item_id: string; item_title: string; category: string; work: string };
type Response = {
  summary?: { mode: string; items_without_work_total: number | null; would_link: number; linked: number; low_confidence: number; no_match: number; next_offset: number; batch: { offset: number; returned: number } };
  results?: Result[];
  mismatches?: Mismatch[];
  error?: string;
};

export default function BackfillPanel() {
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<"" | "dry" | "apply">("");
  const [data, setData] = useState<Response | null>(null);

  async function call(apply: boolean, at = offset) {
    setBusy(apply ? "apply" : "dry");
    try {
      const res = await fetch(`/api/admin/backfill-works?limit=20&offset=${at}`, { method: apply ? "POST" : "GET" });
      setData(res.ok ? await res.json() : { error: `${res.status} ${await res.text()}` });
    } catch (e) {
      setData({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setBusy("");
    }
  }

  const s = data?.summary;
  return (
    <section className="stack" style={{ maxWidth: 900 }}>
      <div className="actions">
        <button type="button" className="btn" disabled={!!busy} onClick={() => call(false)}>
          {busy === "dry" ? "Looking up…" : "Dry run (20 items)"}
        </button>
        <button type="button" className="cta" disabled={!!busy || !s || s.mode !== "dry run" || s.would_link === 0} onClick={() => call(true)}>
          {busy === "apply" ? "Linking…" : `Link ${s?.mode === "dry run" ? s.would_link : ""} sure matches`}
        </button>
        {s && s.batch.returned > 0 && (
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => {
              setOffset(s.next_offset);
              call(false, s.next_offset);
            }}
          >
            Next 20
          </button>
        )}
      </div>
      <p className="hint">Each batch takes up to half a minute: some catalogs only allow one question per second.</p>
      {data?.error && <p className="error">{data.error}</p>}
      {s && (
        <p className="bio">
          {s.mode === "apply" ? `Linked ${s.linked}. ` : ""}
          Items without a catalog link: {s.items_without_work_total ?? "?"}. This batch (from {s.batch.offset}): {s.would_link} sure,{" "}
          {s.low_confidence} unsure (skipped), {s.no_match} not found.
        </p>
      )}
      {data?.results && data.results.length > 0 && (
        <table className="backfill-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Would match</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.item_id}>
                <td>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="hint">
                    {r.category}
                    {r.by ? ` · ${r.by}` : ""}
                  </span>
                </td>
                <td>
                  {r.match ? (
                    <>
                      {r.match.title}
                      {r.match.by ? ` · ${r.match.by}` : ""}
                      <br />
                      <span className="hint">
                        {r.match.source} {r.match.source_id} · {r.match.confidence}
                      </span>
                    </>
                  ) : (
                    <span className="hint">nothing</span>
                  )}
                </td>
                <td>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.mismatches && data.mismatches.length > 0 && (
        <>
          <p className="lede" style={{ fontSize: 18 }}>Linked to the wrong kind of work ({data.mismatches.length})</p>
          <p className="hint">Not changed automatically. Edit the item, or unlink it in the Supabase dashboard (items.work_id).</p>
          <ul>
            {data.mismatches.map((m) => (
              <li key={m.item_id}>
                {m.item_title} ({m.category}) → {m.work}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
