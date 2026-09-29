// Every line on /news. Short, British, no hyphens; "add" is the act, "keep" the collection.

export const NEWS = {
  nav: "News",
  heading: "news for you.",
  empty: "Nothing yet. When someone follows your page, saves one of your hoshigos or becomes your friend, it shows up here.",
  thisWeek: "this week",
  lastWeek: "last week",
  earlier: "earlier",
  weekOf: (d: string) => `week of ${d}`,
  older: "Older",
  newer: "Newer",
  onlyYou: "Only you see this page.",
  missing: "news is almost here. Check back soon.",
  // single events
  accepted: "and you are friends now.",
  follower: "now follows your page.",
  saved: "saved",
  savedTail: "for someday.",
  loved: "loved",
  lovedTail: "and added it to their own.",
  // bundles: "Sara, Cas and 5 others" + tail
  others: (n: number) => (n === 1 ? "1 other" : `${n} others`),
  wasSaved: "was saved for someday by",
  wasLoved: "was loved and added to their own by",
  lovedThem: (n: number) => (n === 1 ? "and added it to their own." : "and added them to their own."),
  bundleFollowers: (n: number) => `${n} new people follow your page`,
  bundleAccepted: "are your friends now",
  weekTail: (thisWeek: boolean) => (thisWeek ? " this week." : "."),
  // weekly email line
  inspirational: (saved: number, loved: number) => {
    const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);
    const parts = [saved ? `saved by ${people(saved)}` : "", loved ? `loved by ${people(loved)}` : ""].filter(Boolean);
    return `You are inspirational! Your hoshigos were ${parts.join(" and ")} this week.`;
  },
} as const;
