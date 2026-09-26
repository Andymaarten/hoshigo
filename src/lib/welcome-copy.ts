// All welcome email copy in one place, from Yuki's docs/emails/welcome.md. Change words here.

export type WelcomeStep = 1 | 2 | 3;

// Step 1 is the welcome, sent the moment onboarding is finished (src/app/onboarding/actions.ts);
// the daily run only catches it up if that send failed. It replaced "Your first five" on day 4.
export const WELCOME_DAYS: Record<WelcomeStep, number> = { 1: 0, 2: 10, 3: 21 };

export const WELCOME_MOTIF = "hoshigo · 星五 · five stars";
export const WELCOME_SIGNATURE = "Hoshi";

export const WELCOME_COPY: Record<WelcomeStep, { subject: string; preheader: string; heading: string; paragraphs: string[]; button: string }> = {
  1: {
    subject: "Your hoshigo is ready",
    preheader: "It holds only what you have given five stars, so there's no rush to fill it.",
    heading: "Your hoshigo is ready.",
    paragraphs: [
      "It holds only what you have given five stars, so there's no rush to fill it.",
      "Start with one: the film you still think about, or the book you keep lending out.",
    ],
    button: "add a hoshigo",
  },
  2: {
    subject: "hoshigo, one tap away",
    preheader: "Put hoshigo on your home screen, and add from any app.",
    heading: "A place on your home screen.",
    paragraphs: [
      "The best things turn up when you're not looking: a song in a café, a book on a friend's shelf.",
      "Put hoshigo on your home screen and it's one tap away when they do. Then you can add from any app, straight from the share sheet. It takes a minute to set up; I timed it.",
    ],
    button: "Put hoshigo on my phone",
  },
  3: {
    subject: "From the community",
    preheader: "A few things other people would give five stars, and a link for a friend.",
    heading: "What others are keeping.",
    paragraphs: [
      "Three weeks in. By now you know the feeling: a page that says something true about you, readable in thirty seconds.",
      "The best part of hoshigo is other people's pages. Below are a few things kept this week, by hand, by real people.",
      "And if someone comes to mind whose five stars you'd like to see, here is your invite link. Whoever opens it becomes your friend straight away.",
    ],
    button: "Invite a friend",
  },
};

export const WELCOME_INSPIRATION = "Do you seek inspiration?";
export const WELCOME_GOODBYE = "Hope to see you soon";
export const WELCOME_PS = "PS: You can also use hoshigo as an app on your phone.";
export const WELCOME_PS_LINK = "Press here to install.";

export const COMMUNITY_HEADING = "from the community";
export const COMMUNITY_INTRO = "A few things other people would give five stars this week.";
export const keptBy = (name: string) => `kept by ${name}`;

export const WELCOME_FOOTER = "";
export const WELCOME_ONE_TAP = "Stop the occasional emails from Hoshi";
