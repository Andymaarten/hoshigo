// All welcome email copy in one place. PLACEHOLDER text until Yuki's docs/emails/welcome.md
// lands: replace the strings below with hers, nothing else needs to change.

export type WelcomeStep = 1 | 2 | 3;

export const WELCOME_DAYS: Record<WelcomeStep, number> = { 1: 4, 2: 10, 3: 21 };

export const WELCOME_COPY: Record<
  WelcomeStep,
  { subject: string; preheader: string; heading: string; paragraphs: string[]; button: string; picksIntro: string }
> = {
  1: {
    subject: "Your hoshigo page, a few days in",
    preheader: "A handful of things is all it takes.",
    heading: "A few days in",
    paragraphs: [
      "Hi {name},",
      "Your page is there, waiting for a few more things you would give five stars. Three is a lovely start: a film, a book, a place.",
    ],
    button: "Add a hoshigo",
    picksIntro: "A few things people near you keep:",
  },
  2: {
    subject: "hoshigo on your home screen",
    preheader: "One tap to your page.",
    heading: "Keep it close",
    paragraphs: [
      "Hi {name},",
      "hoshigo works nicely from your home screen, so adding something takes a moment when it comes to mind.",
    ],
    button: "Open hoshigo",
    picksIntro: "Meanwhile, from people near you:",
  },
  3: {
    subject: "Three weeks of hoshigo",
    preheader: "What people around you keep.",
    heading: "Three weeks in",
    paragraphs: ["Hi {name},", "Thank you for keeping your page. Here is what people a little further out in your circle keep."],
    button: "Visit your page",
    picksIntro: "Picked for you:",
  },
};

export const WELCOME_FOOTER = "You get this because you recently made a hoshigo page.";
export const WELCOME_STOP = "Stop these emails";
