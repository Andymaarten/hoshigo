import { notFound } from "next/navigation";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { PLATFORMS } from "@/lib/platforms";
import { LINKABLE_SOURCES } from "@/lib/work-links-build";

// Owner only: how many catalogue works have an "Open in …" link, per platform.
export default async function LinksCoveragePage() {
  if (!(await ownerHandle())) notFound();
  const admin = adminClient();
  if (!admin) return <div className="page"><p className="bio">Needs SUPABASE_SERVICE_ROLE_KEY.</p></div>;

  const [{ count: works }, links] = await Promise.all([
    admin.from("works").select("id", { count: "exact", head: true }).in("source", LINKABLE_SOURCES),
    admin.from("work_links").select("work_id, platform, kind").limit(100000),
  ]);
  const rows = new Map<string, { direct: number; search: number }>();
  const withAny = new Set<string>();
  for (const l of links.data ?? []) {
    const r = rows.get(l.platform) ?? { direct: 0, search: 0 };
    r[l.kind === "direct" ? "direct" : "search"]++;
    rows.set(l.platform, r);
    withAny.add(l.work_id);
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="lede">Open in links</p>
        <p className="bio">
          {links.error
            ? "The work_links table doesn't exist yet: run docs/migrations/2026-09-29-work-links.sql."
            : `${withAny.size} of ${works ?? 0} films, series, books and places have links. The daily run adds the rest.`}
        </p>
      </header>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Direct</th>
            <th>Search only</th>
          </tr>
        </thead>
        <tbody>
          {[...rows.entries()]
            .sort((a, b) => b[1].direct - a[1].direct)
            .map(([p, r]) => (
              <tr key={p}>
                <td>{PLATFORMS[p]?.name ?? p}</td>
                <td>{r.direct}</td>
                <td>{r.search}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
