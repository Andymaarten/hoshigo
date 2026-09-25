import { createClient } from "@/lib/supabase/server";
import { addContext } from "@/lib/add-context";
import AddStamp from "@/app/[handle]/AddStamp";

/** The red add stamp for pages other than your own profile. Adds to your own page. */
export default async function HeaderStamp({ hideStamp = false }: { hideStamp?: boolean }) {
  const ctx = await addContext(await createClient());
  if (!ctx) return null;
  return <AddStamp handle={ctx.handle} categories={ctx.categories} pins={ctx.pins} onOwnPage={false} hideStamp={hideStamp} />;
}
