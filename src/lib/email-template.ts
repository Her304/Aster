/**
 * Email-safe HTML in Aster's look: cream paper, deep green ink, a serif for
 * headings, a handwritten eyebrow and a marker-yellow underline. Table layout
 * with inline styles, because most mail clients ignore stylesheets; colours
 * that the site draws with transparency are pre-mixed into solid hex.
 */

const color = {
  paper: "#f6f1e7",
  paperDeep: "#ece4d6",
  white: "#fffdf8",
  ink: "#153d2f",
  inkSoft: "#315546",
  fern: "#537760",
  marker: "#e9b93a",
  line: "#dadfd8", // rgba(21,61,47,0.16) on white
  dash: "#bcc2b7", // rgba(21,61,47,0.26) on paper
} as const;

type Fonts = { display: string; sans: string; hand: string };

/** The site's three faces per language (DESIGN.md), as stacks mail clients can find on the reader's device. */
const FONTS: Record<string, Fonts> = {
  en: {
    display: `'Iowan Old Style','Palatino Linotype','Book Antiqua',Palatino,Georgia,serif`,
    sans: `'Avenir Next',Avenir,'Gill Sans','Trebuchet MS',Arial,sans-serif`,
    hand: `Caveat,cursive`,
  },
  "zh-Hant": {
    display: `'Noto Serif TC','Songti TC',PMingLiU,serif`,
    sans: `'Noto Sans HK','PingFang TC','Microsoft JhengHei',sans-serif`,
    hand: `Caveat,'Noto Sans HK','PingFang TC','Microsoft JhengHei',sans-serif`,
  },
  ja: {
    display: `'Hiragino Mincho ProN','Yu Mincho',YuMincho,serif`,
    sans: `'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic',YuGothic,sans-serif`,
    hand: `Caveat,'Hiragino Sans','Yu Gothic',sans-serif`,
  },
  ko: {
    display: `AppleMyungjo,Batang,serif`,
    sans: `'Apple SD Gothic Neo','Malgun Gothic',sans-serif`,
    hand: `'Apple SD Gothic Neo','Malgun Gothic',sans-serif`,
  },
};

const fontsFor = (lang: string) => FONTS[lang] ?? FONTS.en;

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

interface Shell {
  lang: string;
  title: string;
  /** Inbox preview line; hidden in the message itself. */
  preheader: string;
  eyebrow: string;
  heading: string;
  /** Already-escaped HTML for the middle of the card. */
  body: string;
  /** Small print under the dashed rule inside the card. */
  note: string;
  tagline: string;
  origin: string;
}

function paragraph(font: Fonts, text: string, style = "") {
  return `<p style="margin:0 0 14px;font-family:${font.sans};font-size:15px;line-height:1.6;color:${color.inkSoft};${style}">${escapeHtml(text)}</p>`;
}

function shell({ lang, title, preheader, eyebrow, heading, body, note, tagline, origin }: Shell) {
  const font = fontsFor(lang);
  const logo = `${origin}/email/aster-mark.png`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
  @media (max-width: 600px) {
    .aster-card { padding: 30px 22px 24px !important; }
    .aster-heading { font-size: 26px !important; }
    .aster-code { font-size: 34px !important; letter-spacing: 0.22em !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${color.paper};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${color.paper}" style="background-color:${color.paper};">
  <tr>
    <td align="center" style="padding:36px 16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;"><img src="${escapeHtml(logo)}" width="34" height="34" alt="" style="display:block;border:0;"></td>
                <td style="vertical-align:middle;font-family:${font.display};font-size:22px;color:${color.ink};letter-spacing:-0.01em;">Aster</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="aster-card" style="background-color:${color.white};border:1px solid ${color.line};border-radius:6px;padding:36px 36px 28px;">
            <p style="margin:0 0 4px;font-family:${font.hand};font-size:24px;font-weight:600;line-height:1.2;color:${color.fern};">${escapeHtml(eyebrow)}</p>
            <h1 class="aster-heading" style="margin:0 0 16px;font-family:${font.display};font-size:30px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:${color.ink};">${escapeHtml(heading)}</h1>
            ${body}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
              <tr><td style="border-top:2px dashed ${color.dash};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:16px 0 0;font-family:${font.sans};font-size:13px;line-height:1.55;color:${color.fern};">${escapeHtml(note)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 4px 0;font-family:${font.sans};font-size:12px;line-height:1.5;color:${color.fern};">
            <a href="${escapeHtml(origin)}" style="color:${color.fern};text-decoration:none;">${escapeHtml(tagline)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export interface SignInEmailCopy {
  lang: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  expiry: string;
  ignore: string;
  tagline: string;
}

export function signInEmailHtml(copy: SignInEmailCopy, code: string, origin: string) {
  const font = fontsFor(copy.lang);
  const codeBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
              <tr>
                <td style="background-color:${color.paper};border:1px dashed ${color.dash};border-radius:4px;padding:16px 22px 12px;">
                  <div class="aster-code" style="font-family:${font.display};font-size:40px;line-height:1;letter-spacing:0.28em;color:${color.ink};white-space:nowrap;">${escapeHtml(code)}</div>
                  <div style="height:7px;margin-top:8px;background-color:${color.marker};border-radius:6px;opacity:0.85;font-size:0;line-height:0;">&nbsp;</div>
                </td>
              </tr>
            </table>`;
  return shell({
    lang: copy.lang,
    title: copy.subject,
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    body: paragraph(font, copy.intro) + codeBlock + paragraph(font, copy.expiry, "margin:0;font-size:14px;"),
    note: copy.ignore,
    tagline: copy.tagline,
    origin,
  });
}

export interface MilestoneEmailCopy {
  lang: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  lede: string;
  cta: string;
  turnOff: string;
  tagline: string;
}

export function milestoneEmailHtml(copy: MilestoneEmailCopy, link: string, origin: string) {
  const font = fontsFor(copy.lang);
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
              <tr>
                <td style="background-color:${color.ink};border-radius:4px;">
                  <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 22px;font-family:${font.sans};font-size:14px;font-weight:700;color:${color.white};text-decoration:none;">${escapeHtml(copy.cta)} &rarr;</a>
                </td>
              </tr>
            </table>`;
  return shell({
    lang: copy.lang,
    title: copy.subject,
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    heading: copy.subject,
    body: paragraph(font, copy.lede) + button,
    note: copy.turnOff,
    tagline: copy.tagline,
    origin,
  });
}
