import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";

// What listing views need from each item's catalogue work (e.g. its source, for the
// "Powered by BGG" credit). One query for the whole list; items without a work are untouched.
export async function withWorkInfo<T extends Item>(supabase: SupabaseClient, items: T[]): Promise<T[]> {
  const ids = [...new Set(items.map((i) => i.work_id).filter((x): x is string => !!x))];
  if (!ids.length) return items;
  const { data, error } = await supabase.from("works").select("id, source").in("id", ids.slice(0, 1000));
  if (error || !data) return items;
  const source = new Map(data.map((w: { id: string; source: string }) => [w.id, w.source]));
  return items.map((i) => (i.work_id && source.has(i.work_id) ? { ...i, work_source: source.get(i.work_id) } : i));
}
