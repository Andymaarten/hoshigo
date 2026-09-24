// The public page of a catalog record, so a person can check a suggested match.
// MusicBrainz ids are release groups for albums and recordings for songs.
export function workPageUrl(source: string, sourceId: string, categorySlug?: string): string | null {
  const id = encodeURIComponent(sourceId);
  switch (source) {
    case "tmdb":
      return `https://www.themoviedb.org/movie/${id}`;
    case "tmdb_tv":
      return `https://www.themoviedb.org/tv/${id}`;
    case "musicbrainz":
      return `https://musicbrainz.org/${categorySlug === "songs" ? "recording" : "release-group"}/${id}`;
    case "openlibrary":
      return /^\/works\/OL\d+W$/.test(sourceId) ? `https://openlibrary.org${sourceId}` : null;
    case "itunes":
      return `https://podcasts.apple.com/podcast/id${id}`;
    case "wikidata":
      return `https://www.wikidata.org/wiki/${id}`;
    case "bgg":
      return `https://boardgamegeek.com/boardgame/${id}`;
    case "nominatim": {
      const m = sourceId.match(/^([NWR])(\d+)$/);
      return m ? `https://www.openstreetmap.org/${{ N: "node", W: "way", R: "relation" }[m[1] as "N" | "W" | "R"]}/${m[2]}` : null;
    }
    case "youtube":
      return `https://www.youtube.com/watch?v=${id}`;
    default:
      return null;
  }
}
