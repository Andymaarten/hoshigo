// Where to find a good link, per category: each opens that site's own search for the title.
type Site = { name: string; search: (q: string) => string };

const e = encodeURIComponent;
const web = (name: string, extra = ""): Site => ({ name, search: (q) => `https://duckduckgo.com/?q=${e(`${q}${extra}`)}` });

const SITES: Record<string, Site[]> = {
  films: [
    { name: "Letterboxd", search: (q) => `https://letterboxd.com/search/films/${e(q)}/` },
    { name: "IMDb", search: (q) => `https://www.imdb.com/find/?q=${e(q)}&s=tt` },
  ],
  tv: [
    { name: "IMDb", search: (q) => `https://www.imdb.com/find/?q=${e(q)}&s=tt` },
    { name: "Letterboxd", search: (q) => `https://letterboxd.com/search/${e(q)}/` },
  ],
  books: [
    { name: "Goodreads", search: (q) => `https://www.goodreads.com/search?q=${e(q)}` },
    { name: "The StoryGraph", search: (q) => `https://app.thestorygraph.com/browse?search_term=${e(q)}` },
  ],
  essays: [
    web("The publication"),
    { name: "Substack", search: (q) => `https://substack.com/search/${e(q)}?searching=all_posts` },
    { name: "Medium", search: (q) => `https://medium.com/search?q=${e(q)}` },
  ],
  albums: [
    { name: "Spotify", search: (q) => `https://open.spotify.com/search/${e(q)}/albums` },
    { name: "Bandcamp", search: (q) => `https://bandcamp.com/search?q=${e(q)}&item_type=a` },
    { name: "Apple Music", search: (q) => `https://music.apple.com/us/search?term=${e(q)}` },
  ],
  songs: [
    { name: "Spotify", search: (q) => `https://open.spotify.com/search/${e(q)}/tracks` },
    { name: "Bandcamp", search: (q) => `https://bandcamp.com/search?q=${e(q)}&item_type=t` },
    { name: "Apple Music", search: (q) => `https://music.apple.com/us/search?term=${e(q)}` },
  ],
  podcasts: [
    { name: "Spotify", search: (q) => `https://open.spotify.com/search/${e(q)}/podcasts` },
    { name: "Apple Podcasts", search: (q) => `https://podcasts.apple.com/us/search?term=${e(q)}` },
  ],
  games: [
    { name: "BoardGameGeek", search: (q) => `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${e(q)}` },
    { name: "Steam", search: (q) => `https://store.steampowered.com/search/?term=${e(q)}` },
    { name: "itch.io", search: (q) => `https://itch.io/search?q=${e(q)}` },
  ],
  places: [
    { name: "Google Maps", search: (q) => `https://www.google.com/maps/search/?api=1&query=${e(q)}` },
    web("Its own website", " official website"),
  ],
  videos: [
    { name: "YouTube", search: (q) => `https://www.youtube.com/results?search_query=${e(q)}` },
    // vimeo.com/search showed an error page when checked, so this goes through a web search
    web("Vimeo", " site:vimeo.com"),
  ],
  things: [web("The maker's shop", " official shop")],
};

export function linkHelp(slug: string, title: string): { name: string; href: string }[] {
  const q = title.trim();
  if (!q) return [];
  return (SITES[slug] ?? [web("Search the web")]).map((s) => ({ name: s.name, href: s.search(q) }));
}
