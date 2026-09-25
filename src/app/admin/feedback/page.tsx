import { notFound } from "next/navigation";
import Link from "next/link";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { loadFeedback } from "@/lib/feedback-admin";
import Wordmark from "@/components/Wordmark";
import FeedbackAdmin from "./FeedbackAdmin";

export default async function FeedbackAdminPage() {
  const handle = await ownerHandle();
  if (!handle) notFound();

  const admin = adminClient();
  const data = admin ? await loadFeedback(admin) : null;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={handle} />
        </div>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          feedback
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what people told us.</h1>
        <p className="bio">
          <Link href="/stats">Back to stats</Link> ·{" "}
          {/* a plain link: this is a JSON file download, not a page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/feedback">Export as JSON</a>
        </p>
      </header>
      <main className="stats-main">
        {!admin ? (
          <p className="bio">This page needs SUPABASE_SERVICE_ROLE_KEY.</p>
        ) : !data ? (
          <p className="bio">There is no feedback table yet.</p>
        ) : (
          <>
            {!data.hasStatus && (
              <p className="bio">
                To mark messages as planned or done, run docs/migrations/2026-09-25-feedback-status.sql first.
              </p>
            )}
            <FeedbackAdmin rows={data.rows} hasStatus={data.hasStatus} />
          </>
        )}
      </main>
    </div>
  );
}
