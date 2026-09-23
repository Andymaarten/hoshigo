import { getProfileCard } from "@/lib/share";
import { renderProfileCard } from "@/lib/share-card";

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string; variant: string }> }) {
  const { handle, variant } = await params;
  if (variant !== "profile" && variant !== "invite") return new Response("not found", { status: 404 });
  const card = await getProfileCard(handle);
  if (!card) return new Response("not found", { status: 404 });
  return renderProfileCard(card, variant);
}
