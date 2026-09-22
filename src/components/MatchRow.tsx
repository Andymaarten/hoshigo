import Link from "next/link";

export default function MatchRow({
  handle,
  displayName,
  matchPercent,
}: {
  handle: string;
  displayName: string;
  matchPercent: number;
}) {
  return (
    <li>
      <Link href={`/${handle}`} className="match-row">
        <span className="match-name">{displayName || handle}</span>
        <span className="match-handle">@{handle}</span>
        <span className="match-pct">{matchPercent}% match</span>
      </Link>
    </li>
  );
}
