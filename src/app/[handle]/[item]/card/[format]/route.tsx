import { type NextRequest } from "next/server";
import { getSharedListing, SHARE_FORMATS, type ShareFormat } from "@/lib/share";
import { loadCover, renderShareCard } from "@/lib/share-card";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string; item: string; format: string }> }
) {
  const { handle, item: itemId, format } = await params;
  if (!(format in SHARE_FORMATS)) return new Response("not found", { status: 404 });

  const listing = await getSharedListing(handle, itemId, "public");
  if (listing?.kind !== "listing") return new Response("not found", { status: 404 });

  const cover = await loadCover(listing.item.image_url);
  const res = await renderShareCard(listing, format as ShareFormat, cover);
  if (request.nextUrl.searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="hoshigo-${handle}-${format}.png"`);
  }
  return res;
}
