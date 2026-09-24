import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sortCategories } from "@/lib/category-display";
import Wordmark from "@/components/Wordmark";


type Row = Record<string, unknown>;
const DAYS = 30;

function ownerHandles(): string[] {
  return (process.env.OWNER_HANDLES || "andymaarten")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

// Every table is read in pages (the API returns at most 1000 rows at a time). null = the table
// or a column doesn't exist yet, so that section says so instead of breaking the page.
async function all(admin: SupabaseClient, table: string, cols: string): Promise<Row[] | null> {
  const out: Row[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) return from === 0 ? null : out;
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function dayKey(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function lastDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = DAYS - 1; i >= 0; i--) days.push(dayKey(new Date(now.getTime() - i * 86400000)));
  return days;
}

function perDay(dates: (string | null | undefined)[]): number[] {
  const days = lastDays();
  const counts = new Map(days.map((d) => [d, 0]));
  dates.forEach((d) => {
    if (!d) return;
    const k = dayKey(d);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  });
  return days.map((d) => counts.get(d)!);
}

function top<T>(list: T[], key: (t: T) => string | null, n = 10): [string, number][] {
  const m = new Map<string, number>();
  list.forEach((t) => {
    const k = key(t);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

function domain(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)}%` : "0%";
}

function Bars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const w = 6;
  const gap = 2;
  const h = 40;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <figure className="stats-spark">
      <figcaption>
        {label} <strong>{total}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${values.length * (w + gap)} ${h}`} width={values.length * (w + gap)} height={h} role="img" aria-label={`${label}: ${total} in the last ${DAYS} days`}>
        {values.map((v, i) => {
          const bh = v ? Math.max(2, (v / max) * h) : 1;
          return <rect key={i} x={i * (w + gap)} y={h - bh} width={w} height={bh} className={v ? "on" : "off"} />;
        })}
      </svg>
    </figure>
  );
}

function Missing({ what }: { what: string }) {
  return <p className="bio">No {what} yet (the table isn&apos;t there).</p>;
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
  const handle = (me?.handle as string | undefined)?.toLowerCase();
  if (!handle || !ownerHandles().includes(handle)) notFound();

  const header = (
    <header className="hero">
      <div className="masthead">
        <Wordmark handle={handle} />
      </div>
      <div className="kicker">
        <span className="dot" aria-hidden="true" />
        stats
      </div>
      <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>how it&apos;s going.</h1>
    </header>
  );

  const admin = adminClient();
  if (!admin) {
    return (
      <div className="page">
        {header}
        <main>
          <p className="bio">Stats need SUPABASE_SERVICE_ROLE_KEY.</p>
        </main>
      </div>
    );
  }

  const [profiles, items, friendships, cats, works, misclass, feedback] = await Promise.all([
    all(admin, "profiles", "id, handle, is_private, created_at"),
    all(admin, "items", "id, category_id, work_id, url, note, created_at"),
    all(admin, "friendships", "status, created_at, accepted_at"),
    all(admin, "categories", "id, slug, label, sort_order"),
    all(admin, "works", "id, title, by"),
    all(admin, "classification_feedback", "detected_slug, final_slug"),
    admin.from("feedback").select("created_at, user_id, page, message").order("created_at", { ascending: false }).limit(20),
  ]);

  const people = (profiles ?? []).filter((p) => typeof p.handle === "string" && !(p.handle as string).startsWith("user-"));
  const handleById = new Map((profiles ?? []).map((p) => [p.id as string, p.handle as string]));
  const accepted = (friendships ?? []).filter((f) => f.status === "accepted");
  const pending = (friendships ?? []).filter((f) => f.status === "pending");
  const itemList = items ?? [];

  const categories = sortCategories((cats ?? []) as { id: number; slug: string; label: string; sort_order: number }[]);
  const perCategory = categories.map((c) => ({ label: c.label, n: itemList.filter((i) => i.category_id === c.id).length }));
  const maxCat = Math.max(1, ...perCategory.map((c) => c.n));
  const withWork = itemList.filter((i) => i.work_id).length;
  const withNote = itemList.filter((i) => typeof i.note === "string" && (i.note as string).trim()).length;

  const workById = new Map((works ?? []).map((w) => [w.id as string, w]));
  const topWorks = top(itemList, (i) => (i.work_id as string) || null);
  const topDomains = top(itemList, (i) => domain(i.url));
  const topMisclass = misclass ? top(misclass, (m) => (m.detected_slug && m.final_slug ? `${m.detected_slug} → ${m.final_slug}` : null)) : [];
  const fb = feedback.error ? null : ((feedback.data ?? []) as Row[]);

  const totals: [string, number | string][] = [
    ["people", people.length],
    ["hoshigos kept", itemList.length],
    ["friendships", friendships ? accepted.length : "n/a"],
    ["pending requests", friendships ? pending.length : "n/a"],
    ["public profiles", people.filter((p) => !p.is_private).length],
    ["private profiles", people.filter((p) => p.is_private).length],
    ["feedback messages", fb ? (await admin.from("feedback").select("id", { count: "exact", head: true })).count ?? 0 : "n/a"],
  ];

  return (
    <div className="page">
      {header}
      <main className="stats-main">
        <section>
          <h2>totals</h2>
          <dl className="stats-totals">
            {totals.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>last {DAYS} days</h2>
          <div className="stats-sparks">
            <Bars label="signups" values={perDay(people.map((p) => p.created_at as string))} />
            <Bars label="hoshigos kept" values={perDay(itemList.map((i) => i.created_at as string))} />
            {friendships && <Bars label="friendships made" values={perDay(accepted.map((f) => (f.accepted_at ?? f.created_at) as string))} />}
          </div>
        </section>

        <section>
          <h2>per category</h2>
          <ul className="stats-bars">
            {perCategory.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span>
                <span className="stats-bar" style={{ width: `${(c.n / maxCat) * 100}%` }} />
                <strong>{c.n}</strong>
              </li>
            ))}
          </ul>
          <p className="bio">
            {pct(withWork, itemList.length)} matched to a catalogue, {pct(itemList.length - withWork, itemList.length)} added by hand,{" "}
            {pct(withNote, itemList.length)} with a note.
          </p>
        </section>

        <section>
          <h2>most kept</h2>
          <ol className="stats-list">
            {topWorks.map(([id, n]) => {
              const w = workById.get(id);
              return (
                <li key={id}>
                  {(w?.title as string) ?? "unknown"}
                  {w?.by ? <span className="by">, {w.by as string}</span> : null} <strong>{n}</strong>
                </li>
              );
            })}
          </ol>
          <h2>top link domains</h2>
          <ol className="stats-list">
            {topDomains.map(([d, n]) => (
              <li key={d}>
                {d} <strong>{n}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2>misclassified links</h2>
          {!misclass ? (
            <Missing what="classification log" />
          ) : (
            <>
              <p className="bio">{misclass.length} corrections logged.</p>
              <ol className="stats-list">
                {topMisclass.map(([pair, n]) => (
                  <li key={pair}>
                    {pair} <strong>{n}</strong>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section>
          <h2>latest feedback</h2>
          {!fb ? (
            <Missing what="feedback" />
          ) : fb.length === 0 ? (
            <p className="bio">Nothing yet.</p>
          ) : (
            <ul className="stats-feedback">
              {fb.map((f, i) => (
                <li key={i}>
                  <span className="feed-meta">
                    <time dateTime={f.created_at as string}>{dayKey(f.created_at as string)}</time>
                    <span>{f.user_id ? `@${handleById.get(f.user_id as string) ?? "unknown"}` : "logged out"}</span>
                    {typeof f.page === "string" && f.page && <span>{f.page}</span>}
                  </span>
                  <p>{f.message as string}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
