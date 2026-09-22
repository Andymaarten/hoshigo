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
        <span className="match-name">{displayName || handle}</span>
        <span className="match-handle">@{handle}</span>
        <span className="match-pct">{matchPercent}% match</span>
        {bio && <span className="match-bio">{firstSentence(bio)}</span>}
      </Link>
    </li>
  );
}
