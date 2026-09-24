"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendFeedback } from "@/lib/feedback-action";
import Sheet from "@/components/Sheet";

// Checked in the browser so the root layout doesn't read cookies and turn every page dynamic.
export default function FeedbackTab() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  if (process.env.NEXT_PUBLIC_FEEDBACK_TAB?.trim() === "off" || !loggedIn || pathname === "/") return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await sendFeedback(message, pathname).catch(() => ({ ok: false as const, error: "That didn't go through. Please try again in a moment." }));
    if (res.ok) {
      setStatus("sent");
      setMessage("");
    } else {
      setStatus("idle");
      setError(res.error);
    }
  }

  return (
    <>
      <button
        type="button"
        className="feedback-tab"
        onClick={() => {
          setStatus("idle");
          setError(null);
          setOpen(true);
        }}
      >
        feedback?
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="feedback-title">
        <h3 id="feedback-title">Feedback</h3>
        {status === "sent" ? (
          <p className="note">Thank you. It went straight to the person who makes hoshigo.</p>
        ) : (
          <form className="stack" onSubmit={submit}>
            <p className="meta">
              Something unclear? Not working? Missing? Broken? We would love to hear from you in order to get this
              right. If you want to send a screenshot, please send it to <a href="mailto:hi@hoshigo.cc">hi@hoshigo.cc</a>.
            </p>
            <textarea
              className="feedback-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={5}
              required
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn" style={{ alignSelf: "flex-start" }} disabled={status === "sending" || !message.trim()}>
              {status === "sending" ? "Sending" : "Send"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
