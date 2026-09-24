import { notFound } from "next/navigation";
import { ownerHandle } from "@/lib/owner";
import BackfillPanel from "./BackfillPanel";

// Owner only: link existing items to catalog works (see /api/admin/backfill-works).
export default async function BackfillPage() {
  if (!(await ownerHandle())) notFound();
  return (
    <div className="page">
      <header className="hero">
        <p className="lede">Link items to the catalog</p>
        <p className="bio">
          Items in films, books, albums and the other catalog categories that have no catalog link yet. Check the dry run,
          then link the sure matches. Only the link to the catalog is added; titles, links, photos and notes stay as they
          are.
        </p>
      </header>
      <BackfillPanel />
    </div>
  );
}
