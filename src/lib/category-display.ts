export const SHAPE: Record<string, "tall" | "photo" | undefined> = {
  films: "tall",
  books: "tall",
  tv: "tall",
  things: "photo",
  games: "photo",
  podcasts: "photo",
  places: "photo",
  videos: "photo",
};

// Categories with a catalog to search. Must match SEARCHABLE_CATEGORIES in resolve-work.ts.
export const SEARCHABLE = new Set(["films", "tv", "albums", "songs", "books", "podcasts", "places"]);

// One definitive cover comes from the catalog here, so no photo picker once matched.
export const COVER_FROM_CATALOG = new Set(["albums", "books", "songs", "podcasts"]);

export const BY_LABEL: Record<string, string> = {
  films: "Director",
  tv: "Made by",
  albums: "Artist",
  songs: "Artist",
  books: "Author",
  podcasts: "Host",
  places: "Where",
  videos: "Channel",
  essays: "Writer",
  games: "Studio",
  things: "Made by",
};

export const SEARCH_HINT: Record<string, string> = {
  films: "Film title, e.g. Paris, Texas",
  tv: "Series title",
  albums: "Album and artist",
  songs: "Song and artist",
  books: "Title or author, any language",
  podcasts: "Podcast name",
  places: "Place and city, e.g. Rijksmuseum Amsterdam",
};

export const SOURCE_NAME: Record<string, string> = {
  tmdb: "TMDB",
  tmdb_tv: "TMDB",
  musicbrainz: "MusicBrainz",
  openlibrary: "Open Library",
  itunes: "Apple Podcasts",
  igdb: "IGDB",
  youtube: "YouTube",
  nominatim: "OpenStreetMap",
};
