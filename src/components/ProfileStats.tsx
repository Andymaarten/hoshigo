export default function ProfileStats({ friendCount, followerCount }: { friendCount: number; followerCount: number }) {
  return (
    <p className="stats">
      {friendCount} friends · {followerCount} followers
    </p>
  );
}

/** Deterministic placeholder counts derived from a handle, until real follows exist. */
export function placeholderCounts(handle: string): { friendCount: number; followerCount: number } {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  }
  const friendCount = 3 + (hash % 58);
  const followerCount = 20 + ((hash >>> 3) % 780);
  return { friendCount, followerCount };
}
