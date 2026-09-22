import Link from "next/link";

function firstSentence(text: string) {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text).trim();
}

export default function MatchRow({
  handle,
  displayName,
  matchPercent,
  bio,
}: {
  handle: string;
  displayName: string;
  matchPercent: number;
  bio?: string;
}) {
  return (
    <li>
      <Link href={`/${handle}`} className="match-row">
        {/* Real matching isn't live yet, so these are placeholder rows — but
            blurred anyway so nobody can already look a specific person up by
            name/handle from this page before matching (and consent) exist. */}
        <span className="match-name match-blur">{displayName || handle}</span>
        <span className="match-handle">
          @<span className="match-blur">{handle}</span>
        </span>
        <span className="match-pct">{matchPercent}% match</span>
        {bio && <span className="match-bio">{firstSentence(bio)}</span>}
      </Link>
    </li>
  );
}
