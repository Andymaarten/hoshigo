// The hoshigo email layout, v2: a quiet sheet of paper. Wordmark and 星五 at the top,
// a heading, a few paragraphs, one red button, optionally a few picks from other people's
// pages, a signature and a small footer. Lots of room around everything.
//
// Tables and inline styles only, because Gmail, Outlook, Apple Mail and Proton ignore most
// other CSS. Colours are set as both bgcolor and style, and the email says it is light only,
// so dark mode clients leave the paper alone (Apple Mail, Gmail) or invert it evenly (Outlook).
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
  /** a short line of their own, shown in italic */
  note?: string;
  /** the listing page on hoshigo */
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
  /** two or three things people keep, with a small cover each */
  community?: { heading?: string; picks: EmailPick[] };
  /** a closing line, e.g. "Hoshi" */
  signature?: string;
  footer: string;
  /** one tap to the switch that stops this email; every email to users should have one */
  footerLink?: { label: string; href: string };
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
const JA = "font-family:'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif;";

const segments = (p: EmailParagraph): EmailSegment[] => (typeof p === "string" ? [p] : p);
const brs = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

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

function pickHtml(p: EmailPick, last: boolean) {
  const href = escapeHtml(p.href);
  const cover = p.image
    ? `<a href="${href}" style="text-decoration:none;"><img src="${escapeHtml(p.image)}" width="80" height="80" alt="${escapeHtml(p.title)}" style="display:block; width:80px; height:80px; object-fit:cover; border:1px solid ${RULE}; border-radius:2px; background-color:${SHEET};"></a>`
    : `<div style="width:80px; height:80px; border:1px solid ${RULE}; border-radius:2px; background-color:${SHEET};"></div>`;
  const by = p.by ? `<div style="${SERIF} font-size:15px; line-height:1.4; color:${MUTED};">${escapeHtml(p.by)}</div>` : "";
  const note = p.note
    ? `<div style="${SERIF} font-size:15px; line-height:1.45; font-style:italic; color:${INK}; padding-top:6px;">${escapeHtml(p.note)}</div>`
    : "";
  return `<tr><td style="padding:0 0 ${last ? 0 : 22}px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="80" valign="top" style="width:80px;">${cover}</td>
    <td valign="top" style="padding-left:18px;">
      <a href="${href}" style="${SERIF} font-size:18px; line-height:1.3; color:${INK}; text-decoration:none;">${escapeHtml(p.title)}</a>
      ${by}
      <div style="${SANS} font-size:12px; line-height:1.5; letter-spacing:0.02em; color:${MUTED}; padding-top:4px;">from ${escapeHtml(possessive(p.owner))} hoshigo</div>
      ${note}
    </td>
  </tr></table>
</td></tr>`;
}

export function renderEmail({
  preheader,
  heading,
  paragraphs,
  button,
  community,
  signature,
  footer,
  footerLink,
}: EmailInput): { html: string; text: string } {
  const body = paragraphs
    .map((p) => `<tr><td style="${SERIF} font-size:18px; line-height:1.6; color:${INK}; padding-bottom:18px;">${paragraphHtml(p)}</td></tr>`)
    .join("\n");

  const buttonHtml = button
    ? `<tr><td style="padding:18px 0 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td bgcolor="${RED}" style="background-color:${RED}; border-radius:2px;">
      <a href="${escapeHtml(button.href)}" style="display:inline-block; padding:15px 30px; ${SANS} font-size:16px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:2px;">${escapeHtml(button.label)}</a>
    </td>
  </tr></table>
</td></tr>`
    : "";

  const picks = community?.picks.slice(0, 3) ?? [];
  const communityHtml = picks.length
    ? `<tr><td style="padding:44px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="border-top:1px solid ${RULE}; padding:28px 0 22px; ${SANS} font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:${MUTED};">${escapeHtml(community?.heading ?? "Kept by others")}</td></tr>
    ${picks.map((p, i) => pickHtml(p, i === picks.length - 1)).join("\n")}
  </table>
</td></tr>`
    : "";

  const signatureHtml = signature
    ? `<tr><td style="${SERIF} font-size:18px; line-height:1.5; font-style:italic; color:${INK}; padding:${picks.length ? 36 : 22}px 0 0;">${brs(signature)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(heading)}</title>
<style>:root { color-scheme: light only; } a { color: ${INK}; }</style>
</head>
<body style="margin:0; padding:0; background-color:${PAPER}; -webkit-text-size-adjust:100%;" bgcolor="${PAPER}">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAPER}" style="background-color:${PAPER};">
<tr><td align="center" style="padding:56px 22px 48px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding-bottom:52px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="bottom" style="${SERIF} font-size:30px; line-height:1; color:${INK};">hoshigo</td>
    <td valign="bottom" align="right" style="${JA} font-size:15px; line-height:1; color:${MUTED}; letter-spacing:0.18em;"><span style="color:${RED}; font-size:9px; vertical-align:2px;">&#9679;</span>&nbsp;星五</td>
  </tr></table>
</td></tr>
<tr><td style="${SERIF} font-size:30px; line-height:1.25; color:${INK}; padding-bottom:24px;">${escapeHtml(heading)}</td></tr>
${body}
${buttonHtml}
${communityHtml}
${signatureHtml}
<tr><td style="padding-top:56px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="border-top:1px solid ${RULE}; padding-top:20px; ${SANS} font-size:12px; line-height:1.6; color:${MUTED};">${brs(footer)}${
      footerLink ? ` <a href="${escapeHtml(footerLink.href)}" style="color:${MUTED}; text-decoration:underline;">${escapeHtml(footerLink.label)}</a>` : ""
    }</td>
  </tr></table>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [paragraphText(p), ""]),
    ...(button ? [`${button.label}: ${button.href}`, ""] : []),
    ...(picks.length
      ? [
          (community?.heading ?? "Kept by others").toUpperCase(),
          "",
          ...picks.flatMap((p) => [
            `${p.title}${p.by ? `, ${p.by}` : ""}`,
            `from ${possessive(p.owner)} hoshigo`,
            ...(p.note ? [`"${p.note}"`] : []),
            p.href,
            "",
          ]),
        ]
      : []),
    ...(signature ? [signature, ""] : []),
    "—",
    footer,
    ...(footerLink ? [`${footerLink.label}: ${footerLink.href}`] : []),
    "",
    "hoshigo · 星五",
  ].join("\n");

  return { html, text };
}
