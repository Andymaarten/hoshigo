import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import Wordmark from "@/components/Wordmark";
import InstallHintText from "@/components/InstallHintText";
import AndroidHint from "./AndroidHint";
import Bookmarklet from "./Bookmarklet";
import styles from "./app.module.css";
import Choices from "./Choices";
import { AndroidIcon, LaptopIcon, PhoneIcon } from "./icons";
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
        <Choices
          choices={[
            {
              key: "ios",
              label: "iPhone and iPad",
              icon: <PhoneIcon />,
              panel: (
                <>
                  <InstallHintText platform="ios" />
                  <ol>
                    <li>Open hoshigo.cc in Safari.</li>
                    <li>Tap the share icon at the bottom of the screen.</li>
                    <li>
                      Scroll down a little and tap <b>Add to Home Screen</b>, then <b>Add</b>.
                    </li>
                  </ol>
                  <p className="app-note">Opened hoshigo from Instagram or WhatsApp? Open it in Safari first; in those apps the option is missing.</p>
                </>
              ),
            },
            {
              key: "android",
              label: "Android",
              icon: <AndroidIcon />,
              panel: (
                <>
                  <AndroidHint />
                  <ol>
                    <li>Open hoshigo.cc in Chrome.</li>
                    <li>
                      Tap the menu <b>⋮</b>, then <b>Install app</b> or <b>Add to Home screen</b>.
                    </li>
                  </ol>
                </>
              ),
            },
            {
              key: "computer",
              label: "Computer",
              icon: <LaptopIcon />,
              panel: (
                <>
                  <ol>
                    <li>Open hoshigo.cc in Chrome or Edge.</li>
                    <li>
                      Click the install icon at the right of the address bar, or choose <b>Install hoshigo</b> from the menu.
                    </li>
                  </ol>
                  <p className="app-note">On a Mac with Safari: File, then Add to Dock.</p>
                </>
              ),
            },
          ]}
        />

        {/* second in importance to installing, so it waits behind a quiet link */}
        <details className={styles.more} id="add-from-any-app">
          <summary>Click here if you want to learn how to add hoshigos automatically</summary>
          <section>
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
        </details>
      </main>

      <SiteFooter loggedIn={!!user} handle={myHandle} />
    </div>
  );
}
