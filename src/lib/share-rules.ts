// Non friends only see the newest few per category. Keep in sync with FIRST_PAGE_SIZE in
// src/app/[handle]/CategorySection.tsx.
export const PUBLIC_PER_CATEGORY = 5;

export function isPublicRank(rankInCategory: number): boolean {
  return rankInCategory >= 0 && rankInCategory < PUBLIC_PER_CATEGORY;
}

export type Viewer = { userId: string | null; isOwner: boolean; isFriend: boolean };

// Private profiles show non friends only name and bio, never listings.
export function canViewProfileItems(viewer: Viewer, isPrivate: boolean): boolean {
  return viewer.isOwner || viewer.isFriend || !isPrivate;
}

// The single place that decides whether a viewer may see a listing via its share URL or
// share images. When friendships exist, set isFriend in getSharedListing and this follows.
export function canViewItem(viewer: Viewer, rankInCategory: number): boolean {
  if (viewer.isOwner || viewer.isFriend) return true;
  return isPublicRank(rankInCategory);
}
