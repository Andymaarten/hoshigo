import type { Item } from "@/lib/supabase/types";

/** Profile order within a category: the pinned listing first, then newest (ties by id). */
export function compareForProfile(a: Item, b: Item): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export type PinMap = Record<number, { id: string; title: string }>;

/** A prefilled add, sent from a listing sheet to the add stamp on the same page. */
export const ADD_PREFILL_EVENT = "hoshigo:add-prefill";
export type AddPrefill = {
  categoryId: number;
  workId: string | null;
  title: string;
  by: string | null;
  year: number | null;
  url: string | null;
  sourceLabel: string | null;
  imageUrl: string | null;
  // places: OSM type and location, when the item has them
  placeType?: string | null;
  city?: string | null;
  country?: string | null;
};
