"use client";

import { useState } from "react";
import CoverImage from "@/components/CoverImage";
import { displayUrl } from "@/lib/link-input";
import { SOURCE_NAME } from "@/lib/category-display";

type Match = {
  source: string;
  source_id: string;
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
  detail: string | null;
  confidence: "high" | "low";
  page_url: string | null;
};
type Result = { item: { id: string; title: string; by: string | null; category: string; url: string | null }; match: Match | null };
type Mismatch = { item_id: string; item_title: string; category: string; work: string };
type ListResponse = {
  summary?: { offset: number; returned: number; hidden_rejected: number; items_without_work_total: number | null; next_offset: number };
  rejections_saved?: boolean;
  results?: Result[];
  mismatches?: Mismatch[];
  error?: string;
};
type RowState = { status: "open" | "busy" | "linked" | "rejected" | "error"; workId?: string; message?: string };

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/backfill-works", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
  return res.json();
}

export default function BackfillPanel() {
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [lastLinked, setLastLinked] = useState<{ itemId: string; workId: string; title: string } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load(at: number) {
    setLoading(true);
    setRows({});
    try {
      const res = await fetch(`/api/admin/backfill-works?limit=20&offset=${at}`);
      setData(res.ok ? await res.json() : { error: `${res.status} ${await res.text()}` });
      setOffset(at);
    } catch (e) {
      setData({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  const setRow = (id: string, s: RowState) => setRows((r) => ({ ...r, [id]: s }));

  async function link(r: Result) {
    if (!r.match) return;
    setRow(r.item.id, { status: "busy" });
    const res = await post({ action: "link", item_id: r.item.id, source: r.match.source, source_id: r.match.source_id });
    if (res.ok) {
      setRow(r.item.id, { status: "linked", workId: res.work_id });
      setLastLinked({ itemId: r.item.id, workId: res.work_id, title: r.item.title });
    } else setRow(r.item.id, { status: "error", message: res.error });
  }

  async function reject(r: Result) {
    if (!r.match) return;
    setRow(r.item.id, { status: "busy" });
    const res = await post({ action: "reject", item_id: r.item.id, source: r.match.source, source_id: r.match.source_id });
    setRow(r.item.id, {
      status: "rejected",
      message: res.saved ? undefined : "Hidden for now; not remembered yet (run the backfill-rejections migration).",
    });
  }

  async function undo(itemId: string, workId: string) {
    setRow(itemId, { status: "busy" });
    const res = await post({ action: "unlink", item_id: itemId, work_id: workId });
    setRow(itemId, res.ok ? { status: "open" } : { status: "error", message: res.error });
    if (res.ok && lastLinked?.itemId === itemId) setLastLinked(null);
  }

  const results = data?.results ?? [];
  const sureOpen = results.filter((r) => r.match?.confidence === "high" && (rows[r.item.id]?.status ?? "open") === "open");

  async function linkAllSure() {
    setBulkBusy(true);
    sureOpen.forEach((r) => setRow(r.item.id, { status: "busy" }));
    const res = await post({
      action: "link_sure",
      items: sureOpen.map((r) => ({ item_id: r.item.id, source: r.match!.source, source_id: r.match!.source_id })),
    });
    for (const l of (res.linked ?? []) as { item_id: string; work_id: string }[]) setRow(l.item_id, { status: "linked", workId: l.work_id });
    for (const f of (res.failed ?? []) as { item_id: string; error: string }[]) setRow(f.item_id, { status: "error", message: f.error });
    setBulkBusy(false);
  }

  const s = data?.summary;
  return (
    <section className="stack" style={{ maxWidth: 980 }}>
      <div className="actions">
        <button type="button" className="cta" disabled={loading} onClick={() => load(offset)}>
          {loading ? "Looking up…" : data ? "Refresh these 20" : "Show suggestions"}
        </button>
        {s && s.returned + s.hidden_rejected > 0 && (
          <button type="button" className="btn" disabled={loading} onClick={() => load(s.next_offset)}>
            Next 20
          </button>
        )}
        {sureOpen.length > 0 && (
          <button type="button" className="btn" disabled={bulkBusy || loading} onClick={linkAllSure}>
            {bulkBusy ? "Linking…" : `Link all ${sureOpen.length} sure matches`}
          </button>
        )}
        {lastLinked && (
          <button type="button" className="linkish" onClick={() => undo(lastLinked.itemId, lastLinked.workId)}>
            Undo last link ({lastLinked.title})
          </button>
        )}
      </div>
      <p className="hint">Looking up 20 items takes up to half a minute: some catalogs allow one question per second.</p>
      {data?.error && <p className="error">{data.error}</p>}
      {data && data.rejections_saved === false && (
        <p className="hint">&ldquo;Not this one&rdquo; isn&apos;t remembered yet: run docs/migrations/2026-09-25-backfill-rejections.sql.</p>
      )}
      {s && (
        <p className="bio">
          Items without a catalog link: {s.items_without_work_total ?? "?"}. Showing {s.returned} from {s.offset}
          {s.hidden_rejected ? `, ${s.hidden_rejected} hidden because you said "not this one"` : ""}.
        </p>
      )}

      {results.length > 0 && (
        <ul className="review-list">
          {results.map((r) => {
            const state = rows[r.item.id] ?? { status: "open" as const };
            const m = r.match;
            return (
              <li key={r.item.id} className={`review-row${state.status === "linked" ? " done" : ""}${state.status === "rejected" ? " dim" : ""}`}>
                <div className="review-item">
                  <span className="kind">{r.item.category}</span>
                  <strong>{r.item.title}</strong>
                  {r.item.by && <span className="by">{r.item.by}</span>}
                  {r.item.url && (
                    <a href={r.item.url} target="_blank" rel="noopener" className="link-dest">
                      {displayUrl(r.item.url, 48)} ↗
                    </a>
                  )}
                </div>
                <div className="review-match">
                  {m ? (
                    <>
                      <div className="thumb" style={{ width: 52, height: 52 }}>
                        <CoverImage src={m.image_url} />
                      </div>
                      <div className="txt">
                        <span className={m.confidence === "high" ? "kind" : "kind unsure"}>{m.confidence === "high" ? "sure" : "unsure"}</span>
                        <strong>{m.title}</strong>
                        <span className="by">{[m.by, m.year].filter(Boolean).join(", ")}</span>
                        {m.detail && <span className="hint">{m.detail}</span>}
                        {m.page_url ? (
                          <a href={m.page_url} target="_blank" rel="noopener" className="link-dest">
                            Check on {SOURCE_NAME[m.source] ?? m.source} ↗
                          </a>
                        ) : (
                          <span className="hint">{SOURCE_NAME[m.source] ?? m.source}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="hint">No suggestion found.</span>
                  )}
                </div>
                <div className="review-actions">
                  {state.status === "open" && m && (
                    <>
                      <button type="button" className="btn btn-small" onClick={() => link(r)}>
                        Link
                      </button>
                      <button type="button" className="linkish" onClick={() => reject(r)}>
                        Not this one
                      </button>
                    </>
                  )}
                  {state.status === "busy" && <span className="hint">…</span>}
                  {state.status === "linked" && (
                    <>
                      <span className="hint">Linked</span>
                      <button type="button" className="linkish" onClick={() => undo(r.item.id, state.workId!)}>
                        Undo
                      </button>
                    </>
                  )}
                  {state.status === "rejected" && <span className="hint">Hidden{state.message ? `. ${state.message}` : ""}</span>}
                  {state.status === "error" && (
                    <>
                      <span className="error">{state.message}</span>
                      <button type="button" className="linkish" onClick={() => setRow(r.item.id, { status: "open" })}>
                        Try again
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data?.mismatches && data.mismatches.length > 0 && (
        <>
          <p className="lede" style={{ fontSize: 18 }}>Linked to the wrong kind of record ({data.mismatches.length})</p>
          <p className="hint">Not changed automatically. Edit the item, or clear items.work_id in the Supabase dashboard.</p>
          <ul>
            {data.mismatches.map((x) => (
              <li key={x.item_id}>
                {x.item_title} ({x.category}) → {x.work}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
