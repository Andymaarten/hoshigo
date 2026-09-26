import { notFound } from "next/navigation";
import Link from "next/link";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { dueWelcomes, welcomeSwitch } from "@/lib/welcome";
import Wordmark from "@/components/Wordmark";
import EmailsAdmin, { type Candidate, type Approved } from "./EmailsAdmin";

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

  // candidates: recent listings on public pages with a cover and a note, catalogue matches first
  const [{ data: recent }, { data: approvedRows }, due] = await Promise.all([
    admin
      .from("items")
      .select("id, profile_id, work_id, title, by, image_url, note, created_at")
      .not("image_url", "is", null)
      .not("note", "is", null)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("pick_approved").select("id, work_id, item_id, created_at").order("created_at", { ascending: false }),
    dueWelcomes(admin),
  ]);
  const ownerIds = [...new Set((recent ?? []).map((i) => i.profile_id as string))];
  const { data: people } = ownerIds.length
    ? await admin.from("profiles").select("id, handle, is_private").in("id", ownerIds)
    : { data: [] };
  const pub = new Map((people ?? []).filter((p) => !p.is_private && !(p.handle as string).startsWith("user-")).map((p) => [p.id as string, p.handle as string]));

  const approvedWorks = new Set((approvedRows ?? []).filter((a) => a.work_id).map((a) => a.work_id as string));
  const approvedItems = new Set((approvedRows ?? []).filter((a) => a.item_id).map((a) => a.item_id as string));

  const candidates: Candidate[] = (recent ?? [])
    .filter((i) => pub.has(i.profile_id as string) && (i.note as string).trim())
    .sort((a, b) => Number(!!b.work_id) - Number(!!a.work_id))
    .slice(0, 60)
    .map((i) => ({
      id: i.id as string,
      title: i.title as string,
      by: (i.by as string) ?? null,
      imageUrl: i.image_url as string,
      note: (i.note as string).trim(),
      handle: pub.get(i.profile_id as string)!,
      matched: !!i.work_id,
      approved: approvedItems.has(i.id as string) || (!!i.work_id && approvedWorks.has(i.work_id as string)),
    }));

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
        <EmailsAdmin on={on} due={due.map((d) => ({ handle: d.handle, step: d.step }))} candidates={candidates} approved={approved} defaultHandle={handle} />
      </main>
    </div>
  );
}
