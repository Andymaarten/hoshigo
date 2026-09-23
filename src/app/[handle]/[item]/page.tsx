import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { excerpt, getSharedListing, shareImagePath, sharePath, SHARE_FORMATS } from "@/lib/share";
import { SHAPE } from "@/lib/category-display";
import CoverImage from "@/components/CoverImage";
import SharePanel from "@/components/SharePanel";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";

type Params = { params: Promise<{ handle: string; item: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, item: itemId } = await params;
  // Metadata is what crawlers see, so it follows public visibility, never the viewer's.
  const listing = await getSharedListing(handle, itemId, "public");
  if (listing?.kind !== "listing") return { title: "hoshigo", robots: { index: false } };
  const { item, profile } = listing;
  const name = profile.display_name || profile.handle;
  const title = `${item.title}${item.by ? `, ${item.by}` : ""}`;
  const description = item.note ? `“${excerpt(item.note, 180)}” One of ${name}’s five stars on hoshigo.` : `One of ${name}’s five stars on hoshigo.`;
  const image = { url: shareImagePath(handle, itemId, "og"), ...SHARE_FORMATS.og, alt: title };
  return {
    title: `${title} · ${name} · hoshigo`,
    description,
    alternates: { canonical: sharePath(handle, itemId) },
    openGraph: { type: "article", siteName: "hoshigo", title, description, url: sharePath(handle, itemId), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ListingPage({ params }: Params) {
  const { handle, item: itemId } = await params;
  const listing = await getSharedListing(handle, itemId);
  if (!listing) notFound();
  const { profile } = listing;

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const loggedIn = !!user.user;
  const isOwner = user.user?.id === profile.id;
  let myHandle: string | undefined;
  if (user.user) {
    myHandle = isOwner
      ? profile.handle
      : (await supabase.from("profiles").select("handle").eq("id", user.user.id).single()).data?.handle;
  }

  const name = profile.display_name || profile.handle;
  const header = (
    <header className="hero">
      <div className="masthead">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
        <SiteNav loggedIn={loggedIn} handle={myHandle} />
      </div>
      <HeaderStamp />
    </header>
  );

  if (listing.kind === "private") {
    return (
      <div className="page">
        {header}
        <main className="listing">
          <div className="listing-body">
            <h1>{name}.</h1>
            {profile.bio && <p className="bio">{profile.bio}</p>}
            <p className="note">{name} keeps their five stars for friends.</p>
            <Link href={`/${profile.handle}`} className="btn listing-more">
              Visit {name}&rsquo;s page
            </Link>
          </div>
        </main>
        <SiteFooter loggedIn={loggedIn} />
      </div>
    );
  }

  const { item, category } = listing;
  // Podcast art is square; cropping it to the 4:3 photo frame cuts off the show title.
  const shape = category?.slug === "podcasts" ? undefined : category ? SHAPE[category.slug] : undefined;

  return (
    <div className="page">
      {header}

      <main className="listing">
        <div className={`listing-cover${shape === "tall" ? "" : shape === "photo" ? " photo" : " square"}`}>
          <CoverImage src={item.image_url} alt="" eager large />
        </div>
        <div className="listing-body">
          <div className="listing-kicker">
            One of <Link href={`/${profile.handle}`}>{name}</Link>&rsquo;s five stars
            {category ? ` · ${category.label}` : ""}
          </div>
          <h1>{item.title}</h1>
          {(item.by || item.year) && <div className="meta">{[item.by, item.year].filter(Boolean).join(", ")}</div>}
          {item.note && <p className="note">{item.note}</p>}
          <Link href={`/${profile.handle}`} className="btn listing-more">
            See all of {name}&rsquo;s five stars
          </Link>
          <SharePanel handle={profile.handle} itemId={item.id} title={item.title} by={item.by} mine={isOwner} friendsOnly={profile.is_private} />
        </div>
      </main>

      <SiteFooter loggedIn={loggedIn} />
    </div>
  );
}
