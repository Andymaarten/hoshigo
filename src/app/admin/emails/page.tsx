import { notFound } from "next/navigation";
import Link from "next/link";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { dueWelcomes, welcomeSwitch } from "@/lib/welcome";
import Wordmark from "@/components/Wordmark";
import EmailsAdmin, { type Approved } from "./EmailsAdmin";
import { browseListings } from "@/lib/picks-browse";
import { sortCategories } from "@/lib/category-display";

export default async function EmailsAdminPage() {
  const handle = await ownerHandle();
  if (!handle) notFound();
  const admin = adminClient();

  const header = (
    <header className="hero">
      <div className="masthead">
        <Wordmark handle={handle} />
      </div>
      <div className="kicker">
        <span className="dot" aria-hidden="true" />
        emails
      </div>
      <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>welcome notes.</h1>
      <p className="bio">
        <Link href="/stats">Stats</Link> · <Link href="/admin/changelog">Changelog</Link>
      </p>
    </header>
  );

  const on = admin ? await welcomeSwitch(admin) : null;
  if (!admin || on === null) {
    return (
      <div className="page">
        {header}
        <main className="stats-main">
          <p className="bio">
            {admin ? "Run docs/migrations/2026-09-27-welcome-mails.sql first." : "This page needs SUPABASE_SERVICE_ROLE_KEY."}
          </p>
        </main>
      </div>
    );
  }

  const [{ data: approvedRows }, due, browse, { data: cats }] = await Promise.all([
    admin.from("pick_approved").select("id, work_id, item_id, created_at").order("created_at", { ascending: false }),
    dueWelcomes(admin),
    browseListings(admin, { q: "", category: null, withNote: false, withCover: false, sort: "newest", page: 0 }),
    admin.from("categories").select("id, slug, label, sort_order"),
  ]);
  const approvedWorks = new Set((approvedRows ?? []).filter((a) => a.work_id).map((a) => a.work_id as string));
  const approvedItems = new Set((approvedRows ?? []).filter((a) => a.item_id).map((a) => a.item_id as string));
  const categories = sortCategories((cats ?? []) as { id: number; slug: string; label: string; sort_order: number }[]).map((c) => ({ id: c.id, label: c.label }));

  // names for the approved list
  const workIds = [...approvedWorks];
  const itemIds = [...approvedItems];
  const [{ data: works }, { data: items }] = await Promise.all([
    workIds.length ? admin.from("works").select("id, title, by").in("id", workIds) : Promise.resolve({ data: [] }),
    itemIds.length ? admin.from("items").select("id, title, by").in("id", itemIds) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map([...(works ?? []), ...(items ?? [])].map((r) => [r.id as string, { title: r.title as string, by: (r.by as string) ?? null }]));
  const approved: Approved[] = (approvedRows ?? []).map((a) => {
    const key = (a.item_id ?? a.work_id) as string;
    return { id: a.id as string, kind: a.item_id ? "listing" : "work", title: names.get(key)?.title ?? "(gone)", by: names.get(key)?.by ?? null };
  });

  return (
    <div className="page">
      {header}
      <main className="stats-main">
        <EmailsAdmin on={on} due={due.map((d) => ({ handle: d.handle, step: d.step }))} categories={categories} browse={browse} approved={approved} defaultHandle={handle} />
      </main>
    </div>
  );
}
