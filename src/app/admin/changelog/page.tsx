import { notFound } from "next/navigation";
import Link from "next/link";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { lastSentAt, pendingEntries, recipientCount, renderUpdate, type ChangelogEntry } from "@/lib/changelog";
import Wordmark from "@/components/Wordmark";
import ChangelogAdmin from "./ChangelogAdmin";

export default async function ChangelogAdminPage() {
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
        changelog
      </div>
      <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what changed.</h1>
      <p className="bio">
        <Link href="/stats">Stats</Link> · <Link href="/admin/emails">Welcome emails</Link>
      </p>
    </header>
  );

  if (!admin) {
    return (
      <div className="page">
        {header}
        <main className="stats-main">
          <p className="bio">This page needs SUPABASE_SERVICE_ROLE_KEY.</p>
        </main>
      </div>
    );
  }

  const { data, error } = await admin
    .from("changelog_entries")
    .select("*")
    .order("shipped_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="page">
        {header}
        <main className="stats-main">
          <p className="bio">Run docs/migrations/2026-09-26-changelog.sql first.</p>
        </main>
      </div>
    );
  }

  const [pending, since, count] = await Promise.all([pendingEntries(admin), lastSentAt(admin), recipientCount(admin)]);
  const preview = pending.length ? renderUpdate(pending, "#unsubscribe").html : null;

  return (
    <div className="page">
      {header}
      <main className="stats-main">
        <ChangelogAdmin
          entries={(data ?? []) as ChangelogEntry[]}
          pendingTitles={pending.map((e) => e.title)}
          lastSent={since}
          recipientCount={count ?? 0}
          previewHtml={preview}
        />
      </main>
    </div>
  );
}
