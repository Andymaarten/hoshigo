import Link from "next/link";

/** Where the wordmark goes: your own page when logged in with a real handle, else home. */
export function wordmarkHref(handle?: string | null): string {
  return handle && !handle.startsWith("user-") ? `/${handle}` : "/";
}

export default function Wordmark({ handle }: { handle?: string | null }) {
  return (
    <Link href={wordmarkHref(handle)} className="word" aria-label="hoshigo">
      hosh<span className="tittle">ı</span>go
    </Link>
  );
}
