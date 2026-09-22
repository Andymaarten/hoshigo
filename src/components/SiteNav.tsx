import Link from "next/link";
import { signOut } from "@/app/[handle]/actions";

export default function SiteNav({ loggedIn = false, handle }: { loggedIn?: boolean; handle?: string }) {
  return (
    <nav className="menu" aria-label="Main">
      {loggedIn && handle && (
        <Link href={`/${handle}`}>
          <span>My hoshigo</span>
        </Link>
      )}
      {loggedIn ? (
        <form action={signOut}>
          <button type="submit" className="btn">
            Log out
          </button>
        </form>
      ) : (
        <Link href="/login">
          <span>Login</span>
        </Link>
      )}
      <Link href="/friends">
        <span>Friends</span>
      </Link>
      <Link href="/explore">
        <span>Explore</span>
      </Link>
    </nav>
  );
}
