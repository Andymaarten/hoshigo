import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import Wordmark from "@/components/Wordmark";
import InstallHintText from "@/components/InstallHintText";
import AndroidHint from "./AndroidHint";
import Bookmarklet from "./Bookmarklet";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "hoshigo as an app",
  description: "Put hoshigo on your home screen, and add to it from any app.",
};

// The owner's shared Shortcut; an env var can point elsewhere without a deploy of new code.
const SHORTCUT_URL =
  process.env.NEXT_PUBLIC_IOS_SHORTCUT_URL?.trim() || "https://www.icloud.com/shortcuts/7c76b6fb4a08439ea161423711350bba";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myHandle = user
    ? ((await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle()).data?.handle as string | undefined)
    : undefined;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <p className="lede">hoshigo as an app</p>
        <p className="bio">
          hoshigo lives on the web, but it can sit on your home screen like any other app: its own icon, no browser bars.
          Nothing to download from a store.
        </p>
      </header>

      <main className="app-guide">
        <section>
          <h2>iPhone and iPad</h2>
          <InstallHintText platform="ios" />
          <p className="app-note">In Safari, the share icon is at the bottom of the screen; scroll the list down a little to find it, then tap Add.</p>
          <p className="app-note">Opened hoshigo from Instagram or WhatsApp? Open it in Safari first; in those apps the option is missing.</p>
        </section>

        <section>
          <h2>Android</h2>
          <AndroidHint />
        </section>

        <section>
          <h2>Computer</h2>
          <ol>
            <li>Open hoshigo.cc in Chrome or Edge.</li>
            <li>
              Click the install icon at the right of the address bar, or choose <b>Install hoshigo</b> from the menu.
            </li>
          </ol>
          <p className="app-note">On a Mac with Safari: File, then Add to Dock.</p>
        </section>

        <section id="add-from-any-app">
          <h2>Add from any app</h2>
          <p>
            Found something in Spotify, YouTube or your browser that deserves a place? Send it straight to hoshigo; it opens
            with the link filled in, ready to add.
          </p>

          <h3>iPhone</h3>
          <p>
            A small Shortcut puts <b>Add to hoshigo</b> in the share sheet of every app.
          </p>
          <a className="btn" href={SHORTCUT_URL} target="_blank" rel="noopener noreferrer">
            Get the iPhone shortcut
          </a>
          <details className="app-details">
            <summary>Or make it yourself</summary>
            <ol>
              <li>Open the Shortcuts app and tap <b>+</b>.</li>
              <li>
                Tap the <b>i</b> at the bottom, turn on <b>Show in Share Sheet</b>, and let it receive <b>URLs</b> and{" "}
                <b>Text</b>.
              </li>
              <li>
                Add the action <b>Open URLs</b> and type <code>https://hoshigo.cc/add?via=shortcut&amp;url=</code>, then insert the{" "}
                <b>Shortcut Input</b> variable right after it.
              </li>
              <li>Name it <b>Add to hoshigo</b> and tap <b>Done</b>.</li>
            </ol>
          </details>

          <h3>Android</h3>
          <p>
            Once hoshigo is installed, it appears in the share sheet of other apps. Tap <b>Share</b>, then <b>hoshigo</b>.
          </p>

          <h3>Computer</h3>
          <p>Drag this to your bookmarks bar, then click it on any page you want to add:</p>
          <Bookmarklet />
        </section>
      </main>

      <SiteFooter loggedIn={!!user} handle={myHandle} />
    </div>
  );
}
