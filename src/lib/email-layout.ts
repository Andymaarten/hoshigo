// The hoshigo email layout, v3: a centred sheet of paper with very little on it.
// 星五 at the top links home; then a heading, a few lines, one button. Optional parts
// (all centred): a painted image button, a few picks from other people's pages, a quiet
// second button, a PS with the app icon, a signature. The footer is one small line.
//
// Tables and inline styles only, because Gmail, Outlook, Apple Mail and Proton ignore most
// other CSS. Colours are set as bgcolor and style, and the email says it is light only, so
// dark mode clients leave the paper alone. Anything with words on a picture is a baked PNG.
//
// Every string passed in is plain text and gets escaped here; a paragraph can mark parts
// as bold with { strong: "..." }. Line breaks inside a paragraph become <br>.

export type EmailSegment = string | { strong: string };
export type EmailParagraph = string | EmailSegment[];

export type EmailPick = {
  title: string;
  by?: string;
  /** whose page it is from, shown as "from Sara's hoshigo" */
  owner: string;
  note?: string;
  href: string;
  /** absolute URL of a cover image; a paper coloured square is shown without one */
  image?: string;
};

export type EmailInput = {
  /** the grey line inbox lists show after the subject */
  preheader: string;
  heading: string;
  paragraphs: EmailParagraph[];
  button?: { label: string; href: string };
  /** a picture that is the button, words baked in (so alt must say the same) */
  imageButton?: { src: string; alt: string; href: string; width: number; height: number };
  /** two or three things people keep, with a small cover each */
  community?: { heading?: string; intro?: string; picks: EmailPick[] };
  /** a second, quieter button in outline */
  quietButton?: { label: string; href: string };
  /** a closing note with the app icon, like a home screen */
  ps?: { text: string; icon: string; iconLabel: string; linkLabel: string; href: string };
  /** a closing line, e.g. "Hoshi" */
  signature?: string;
  footer: string;
  /** one tap to the switch that stops this email; every email to users should have one */
  footerLink?: { label: string; href: string };
  /** where 星五 at the top links to */
  home?: string;
};

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const INK = "#1d1c1a";
const MUTED = "#6b665d";
const PAPER = "#efe7d8";
const SHEET = "#f6f0e4";
const RULE = "#d9cfbf";
const RED = "#d8321f";
const SERIF = "font-family:'Newsreader',Georgia,'Times New Roman',Times,serif;";
const SANS = "font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const JA = "font-family:'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','MS Mincho',serif;";

const segments = (p: EmailParagraph): EmailSegment[] => (typeof p === "string" ? [p] : p);
const brs = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const row = (html: string, pad = "0") => `<tr><td align="center" style="padding:${pad};">${html}</td></tr>`;

function paragraphHtml(p: EmailParagraph) {
  return segments(p)
    .map((s) => (typeof s === "string" ? brs(s) : `<strong style="font-weight:600;">${brs(s.strong)}</strong>`))
    .join("");
}

function paragraphText(p: EmailParagraph) {
  return segments(p)
    .map((s) => (typeof s === "string" ? s : s.strong))
    .join("");
}

function pickHtml(p: EmailPick) {
  const href = escapeHtml(p.href);
  const cover = p.image
    ? `<img src="${escapeHtml(p.image)}" width="64" height="64" alt="${escapeHtml(p.title)}" style="display:block; margin:0 auto; width:64px; height:64px; object-fit:cover; border:1px solid ${RULE}; border-radius:2px; background-color:${SHEET};">`
    : `<div style="margin:0 auto; width:64px; height:64px; border:1px solid ${RULE}; border-radius:2px; background-color:${SHEET};"></div>`;
  return `<tr><td align="center" style="padding:0 0 30px;">
  <a href="${href}" style="text-decoration:none; color:${INK};">
    ${cover}
    <div style="${SERIF} font-size:18px; line-height:1.3; color:${INK}; padding-top:12px;">${escapeHtml(p.title)}</div>
    ${p.by ? `<div style="${SERIF} font-size:15px; line-height:1.4; color:${MUTED};">${escapeHtml(p.by)}</div>` : ""}
    <div style="${SERIF} font-size:14px; line-height:1.5; font-style:italic; color:${MUTED}; padding-top:4px;">from ${escapeHtml(possessive(p.owner))} hoshigo</div>
  </a>
</td></tr>`;
}

export function renderEmail(input: EmailInput): { html: string; text: string } {
  const { preheader, heading, paragraphs, button, imageButton, community, quietButton, ps, signature, footer, footerLink } = input;
  const home = input.home ?? "https://hoshigo.cc";
  const picks = community?.picks.slice(0, 3) ?? [];

  const parts: string[] = [];
  parts.push(
    row(
      `<a href="${escapeHtml(home)}" style="${JA} font-size:34px; line-height:1; letter-spacing:0.12em; color:${INK}; text-decoration:none;">星五</a>`,
      "0 0 64px"
    )
  );
  parts.push(row(`<div style="${SERIF} font-size:28px; line-height:1.3; color:${INK};">${escapeHtml(heading)}</div>`, "0 0 22px"));
  for (const p of paragraphs) {
    parts.push(row(`<div style="${SERIF} font-size:18px; line-height:1.65; color:${INK}; max-width:440px;">${paragraphHtml(p)}</div>`, "0 0 16px"));
  }
  if (imageButton) {
    parts.push(
      row(
        `<a href="${escapeHtml(imageButton.href)}" style="text-decoration:none;"><img src="${escapeHtml(imageButton.src)}" width="${imageButton.width}" height="${imageButton.height}" alt="${escapeHtml(imageButton.alt)}" style="display:block; width:${imageButton.width}px; height:${imageButton.height}px; border:0; ${SERIF} font-size:18px; color:${RED};"></a>`,
        "30px 0 8px"
      )
    );
  }
  if (button) {
    parts.push(
      row(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${RED}" style="background-color:${RED}; border-radius:2px;"><a href="${escapeHtml(button.href)}" style="display:inline-block; padding:14px 30px; ${SANS} font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">${escapeHtml(button.label)}</a></td></tr></table>`,
        "26px 0 8px"
      )
    );
  }
  if (picks.length >= 2) {
    const intro = community?.heading
      ? `<div style="${SERIF} font-size:22px; line-height:1.35; color:${INK};">${escapeHtml(community.heading)}</div>${
          community.intro ? `<div style="${SERIF} font-size:16px; line-height:1.5; color:${MUTED}; padding-top:6px;">${escapeHtml(community.intro)}</div>` : ""
        }`
      : "";
    parts.push(row(intro, "64px 0 30px"));
    parts.push(`<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${picks.map(pickHtml).join("\n")}</table></td></tr>`);
  }
  if (quietButton) {
    parts.push(
      row(
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid ${INK}; border-radius:2px;"><a href="${escapeHtml(quietButton.href)}" style="display:inline-block; padding:12px 26px; ${SERIF} font-size:17px; font-style:italic; color:${INK}; text-decoration:none;">${escapeHtml(quietButton.label)}</a></td></tr></table>`,
        picks.length >= 2 ? "12px 0 0" : "36px 0 0"
      )
    );
  }
  if (signature) {
    parts.push(row(`<div style="${SERIF} font-size:18px; font-style:italic; color:${INK};">${brs(signature)}</div>`, "30px 0 0"));
  }
  if (ps) {
    parts.push(
      row(
        `<div style="${SERIF} font-size:16px; line-height:1.6; color:${INK}; max-width:400px;">${escapeHtml(ps.text)}</div>
<a href="${escapeHtml(ps.href)}" style="display:inline-block; text-decoration:none; padding-top:20px;">
  <img src="${escapeHtml(ps.icon)}" width="64" height="64" alt="${escapeHtml(ps.iconLabel)} app icon" style="display:block; margin:0 auto; width:64px; height:64px; border:0; border-radius:14px;">
  <div style="${SANS} font-size:11px; line-height:1; color:${INK}; padding-top:6px;">${escapeHtml(ps.iconLabel)}</div>
</a>
<div style="padding-top:16px;"><a href="${escapeHtml(ps.href)}" style="${SERIF} font-size:16px; color:${INK}; text-decoration:underline;">${escapeHtml(ps.linkLabel)}</a></div>`,
        "72px 0 0"
      )
    );
  }
  parts.push(
    row(
      `<div style="${SANS} font-size:11px; line-height:1.6; color:${MUTED}; max-width:420px;">${brs(footer)}${
        footerLink ? ` <a href="${escapeHtml(footerLink.href)}" style="color:${MUTED}; text-decoration:underline;">${escapeHtml(footerLink.label)}</a>` : ""
      }</div>`,
      "72px 0 0"
    )
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(heading)}</title>
<style>:root { color-scheme: light only; }</style>
</head>
<body style="margin:0; padding:0; background-color:${PAPER}; -webkit-text-size-adjust:100%;" bgcolor="${PAPER}">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAPER}" style="background-color:${PAPER};">
<tr><td align="center" style="padding:72px 24px 56px;">
<!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; text-align:center;">
${parts.join("\n")}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "星五",
    "",
    heading,
    "",
    ...paragraphs.flatMap((p) => [paragraphText(p), ""]),
    ...(imageButton ? [`${imageButton.alt}: ${imageButton.href}`, ""] : []),
    ...(button ? [`${button.label}: ${button.href}`, ""] : []),
    ...(picks.length >= 2
      ? [
          ...(community?.heading ? [community.heading, ""] : []),
          ...picks.flatMap((p) => [`${p.title}${p.by ? `, ${p.by}` : ""}`, `from ${possessive(p.owner)} hoshigo: ${p.href}`, ""]),
        ]
      : []),
    ...(quietButton ? [`${quietButton.label}: ${quietButton.href}`, ""] : []),
    ...(signature ? [signature, ""] : []),
    ...(ps ? [ps.text, `${ps.linkLabel} ${ps.href}`, ""] : []),
    "—",
    footer,
    ...(footerLink ? [`${footerLink.label}: ${footerLink.href}`] : []),
  ].join("\n");

  return { html, text };
}
