import { adminClient } from "@/lib/supabase/admin";
import { readUnsubscribeToken } from "@/lib/changelog";
import Wordmark from "@/components/Wordmark";

// Opening the link only shows a button: mail scanners open links on their own, and that
// shouldn't switch anyone's emails off. The tap is the one real step (no login needed).
async function stop(formData: FormData) {
  "use server";
  const id = readUnsubscribeToken(String(formData.get("t") || ""));
  const admin = adminClient();
  if (id && admin) await admin.from("profiles").update({ email_updates: false }).eq("id", id);
  const { redirect } = await import("next/navigation");
  redirect(`/unsubscribe?done=${id ? 1 : 0}`);
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  const valid = !!readUnsubscribeToken(t);
  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark />
        </div>
        {done === "1" ? (
          <>
            <p className="lede">Done. No more update emails.</p>
            <p className="bio">You can switch them back on any time in your settings.</p>
          </>
        ) : done === "0" || !valid ? (
          <p className="lede">That link doesn&apos;t work. You can switch update emails off in your settings instead.</p>
        ) : (
          <>
            <p className="lede">Stop the occasional emails about what&apos;s new on hoshigo?</p>
            <form action={stop} style={{ marginTop: 20 }}>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="cta" style={{ border: "none" }}>
                Stop these emails
              </button>
            </form>
          </>
        )}
      </header>
    </div>
  );
}
