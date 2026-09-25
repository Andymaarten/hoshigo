import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/[handle]/actions";
import { SOMEDAY } from "@/lib/someday";
import InstallButton from "./InstallButton";

// Links repeated from the top, so the bottom of every page reads as a proper footer.
// "Inspiration" gets its place here once that page exists.
export default async function SiteFooter({ loggedIn = false, handle }: { loggedIn?: boolean; handle?: string }) {
  let myHandle = handle;
  let someday = false;
  if (loggedIn) {
    const supabase = await createClient();
    someday = !(await supabase.from("someday_items").select("id", { head: true, count: "exact" }).limit(1)).error;
  }
  if (loggedIn && !myHandle) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
      myHandle = (data?.handle as string | undefined) ?? undefined;
    }
  }
  const realHandle = myHandle && !myHandle.startsWith("user-") ? myHandle : undefined;

  return (
    <footer>
      <div className="inner">
        <div className="footer-tag" lang="ja">
          星五
        </div>
        {loggedIn ? (
          <nav className="footer-nav" aria-label="Footer">
            <Link href="/about">About hoshigo</Link>
            {realHandle && <Link href={`/${realHandle}`}>My hoshigo</Link>}
            {someday && <Link href={SOMEDAY.page}>{SOMEDAY.name}</Link>}
            <Link href="/settings">Edit profile</Link>
            <Link href="/friends">Friends</Link>
            <Link href="/explore">Explore</Link>
            <Link href="/app">hoshigo as an app</Link>
            <InstallButton className="footer-link" />
            <form action={signOut}>
              <button type="submit" className="footer-link">
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <div className="footer-msg">
            <p>Keep your own five star page.</p>
            <Link href="/about" className="footer-about">
              About hoshigo
            </Link>
            <Link href="/app" className="footer-about">
              hoshigo as an app
            </Link>
            <Link href="/login" className="cta">
              Sign up / Login
            </Link>
          </div>
        )}
      </div>
    </footer>
  );
}
