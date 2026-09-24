// The hoshigo email layout (same design as docs/email-templates/): cream paper, ink text,
// the red dot wordmark, one red button, a small footer. Tables and inline styles only,
// because Gmail, Apple Mail and Proton ignore most other CSS.
//
// Every string passed in is plain text and gets escaped here; a paragraph can mark parts
// as bold with { strong: "..." }. Line breaks inside a paragraph become <br>.

export type EmailSegment = string | { strong: string };
export type EmailParagraph = string | EmailSegment[];

export type EmailInput = {
  /** the grey line inbox lists show after the subject */
  preheader: string;
  heading: string;
  paragraphs: EmailParagraph[];
  button?: { label: string; href: string };
  footer: string;
  /** one tap to the switch that stops this email; every email to users should have one */
  footerLink?: { label: string; href: string };
};

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const INK = "#1d1c1a";
const MUTED = "#5b574f";
const PAPER = "#efe7d8";
const RED = "#d8321f";
const SERIF = "font-family:'Newsreader',Georgia,'Times New Roman',serif;";
const SANS = "font-family:Helvetica,Arial,sans-serif;";

const segments = (p: EmailParagraph): EmailSegment[] => (typeof p === "string" ? [p] : p);
const brs = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

function paragraphHtml(p: EmailParagraph) {
  return segments(p)
    .map((s) => (typeof s === "string" ? brs(s) : `<strong>${brs(s.strong)}</strong>`))
    .join("");
}

function paragraphText(p: EmailParagraph) {
  return segments(p)
    .map((s) => (typeof s === "string" ? s : s.strong))
    .join("");
}

export function renderEmail({ preheader, heading, paragraphs, button, footer, footerLink }: EmailInput): { html: string; text: string } {
  const body = paragraphs
    .map(
      (p) =>
        `<tr><td style="${SERIF} font-size:17px; line-height:1.55; color:${INK}; padding-bottom:16px;">${paragraphHtml(p)}</td></tr>`
    )
    .join("\n");

  const buttonHtml = button
    ? `<tr><td style="padding:12px 0 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="background-color:${RED};" bgcolor="${RED}">
      <a href="${escapeHtml(button.href)}" style="display:inline-block; padding:14px 28px; ${SANS} font-size:16px; font-weight:700; color:${PAPER}; text-decoration:none;">${escapeHtml(button.label)}</a>
    </td>
  </tr></table>
</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background-color:${PAPER};" bgcolor="${PAPER}">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAPER}" style="background-color:${PAPER};">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="${SERIF} font-size:36px; color:${INK}; padding-bottom:32px;">hosh<span style="position:relative; display:inline-block;">i<span style="position:absolute; top:-3px; left:6px; width:5px; height:5px; border-radius:50%; background-color:${RED}; display:inline-block;"></span></span>go</td></tr>
<tr><td style="${SERIF} font-size:28px; line-height:1.2; color:${INK}; padding-bottom:18px;">${escapeHtml(heading)}</td></tr>
${body}
${buttonHtml}
<tr><td style="${SANS} font-size:13px; line-height:1.5; color:${MUTED}; border-top:1px solid #cfc6b6; padding-top:20px;">${brs(footer)}${
    footerLink ? ` <a href="${escapeHtml(footerLink.href)}" style="color:${MUTED}; text-decoration:underline;">${escapeHtml(footerLink.label)}</a>` : ""
  }</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [paragraphText(p), ""]),
    ...(button ? [`${button.label}: ${button.href}`, ""] : []),
    "—",
    footer,
    ...(footerLink ? [`${footerLink.label}: ${footerLink.href}`] : []),
    "",
    "hoshigo",
  ].join("\n");

  return { html, text };
}
