import type { Metadata } from "next";
import { getProfileCard } from "@/lib/share";
import { profileMetadata } from "@/lib/profile-metadata";

// Lives in the layout so the profile page itself stays untouched; the listing page under
// it sets its own metadata, which replaces this.
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const card = await getProfileCard(handle);
  if (!card) return {};
  return { ...profileMetadata(card, "profile"), alternates: { canonical: `/${card.profile.handle}` } };
}

export default function HandleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
