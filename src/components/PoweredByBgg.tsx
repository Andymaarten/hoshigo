// BGG's XML API terms ask for their "Powered by BGG" logo, linked to BoardGameGeek, wherever
// their data is shown. Hotlinked from BGG's own image host, as they provide it.
const LOGO =
  "https://cf.geekdo-images.com/HZy35cmzmmyV9BarSuk6ug__imagepage/img/FOGhR5OgYhcg-1jdqT5i5W8Xfbg=/fit-in/900x600/filters:no_upscale():strip_icc()/pic7779581.png";

export default function PoweredByBgg() {
  return (
    <a className="bgg-credit" href="https://boardgamegeek.com" target="_blank" rel="noopener">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="Powered by BGG" height={20} />
    </a>
  );
}
