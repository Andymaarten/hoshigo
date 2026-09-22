import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import FriendsList, { type Friend } from "@/components/FriendsList";

const FAKE_FRIENDS: Friend[] = [
  { handle: "user2", displayName: "Mei Sato", tagline: "Films & tv" },
  { handle: "user3", displayName: "Jonas Bergström", tagline: "Books & essays" },
  { handle: "user4", displayName: "Priya Nair", tagline: "Music & podcasts" },
  { handle: "user5", displayName: "Tomás Rivera", tagline: "Things" },
  { handle: "user6", displayName: "Anna Kowalski", tagline: "Films & books" },
];

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myHandle = user
    ? (await supabase.from("profiles").select("handle").eq("id", user.id).single()).data?.handle
    : undefined;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <div className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </div>
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          friends
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>people you follow.</h1>
        <p className="bio">A real follows system is on its way. For now, here&apos;s a preview of the page.</p>
      </header>

      <main>
        <FriendsList friends={FAKE_FRIENDS} />
      </main>

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
