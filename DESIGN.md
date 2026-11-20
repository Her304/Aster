# Aster design

Aster should feel like a friend's scrapbook: cream paper, deep green ink, a few
handwritten notes in the margin, and photos taped to the page. It is calm and
personal, not a dashboard. This file records how that look is built so new
screens, emails and images stay consistent.

The source of truth for values is `src/app/globals.css` (`:root` tokens).
`src/lib/design.test.ts` enforces the two hard rules below.

## Hard rules

1. **Flat elements: no shadows.** No `box-shadow`, `text-shadow` or
   `drop-shadow` anywhere: buttons, cards, modals, photos, emails, images.
   Separate things with a 1px border, a dashed rule, a change of paper tone or
   space. Selected and focused states use borders, outlines or fills, never a
   shadow or an offset block behind the element.
2. **One set of English faces, and at most three faces per script.** Every
   page uses three type roles: display, text and accent. Latin letters
   (names, "MBTI", "ENFP", digits, the wordmark) are always drawn in the same
   three English faces, whatever the page language. Each stack starts with
   them; Chinese, Japanese and Korean faces follow and draw only their own
   script, at most three per script. Names later in a stack are the same role
   on another platform (Mac and Windows), never an extra face.
3. **Colours come from the tokens.** Add a token before adding a new colour.
4. **Handwriting is for static copy only**, never for anything a person types
   (names, answers). The Korean handwriting face is subset to the copy's
   glyphs.

## Colour

| Token | Hex | Used for |
| --- | --- | --- |
| `--paper` | `#f6f1e7` | Page background, inputs |
| `--paper-deep` | `#ece4d6` | Tracks, table headers, quiet fills |
| `--white` | `#fffdf8` | Cards, panels, text on ink |
| `--ink` | `#153d2f` | Text, primary buttons, borders that matter, the dark "How it unfolds" band |
| `--ink-soft` | `#315546` | Body copy |
| `--fern` | `#537760` | Eyebrows, labels, captions, secondary text |
| `--moss` | `#c7d3b7` | Selected fills (type picker), soft accents on dark |
| `--lilac` | `#cbc1db` | "Not sure" selected, secondary highlights |
| `--lilac-deep` | `#9a87b6` | Your own marker on result bars, loading line |
| `--marker` | `#e9b93a` | The yellow highlighter: headline underline, code underline in emails, handwritten step numbers |
| `--tape` | translucent beige | Tape strips on photos |
| `--stamp` | `#bf5b45` | Rare warm accent in handwritten notes |
| `--clay`, `--butter`, `--sky` | | Avatar and petal colours |
| `--line` | `rgba(21,61,47,0.16)` | Default 1px borders and rules |
| `--danger` | `#a33c34` | Errors only |

Dashed separators between page sections are `2px dashed rgba(21,61,47,0.26)`.
In email, where transparency is unreliable, the pre-mixed hexes are `#dadfd8`
(line on white) and `#bcc2b7` (dash on paper).

## Type

Three roles, set as custom properties and switched per language on
`html[lang]`. Latin always uses the English column; the other columns are what
each script's own characters use:

| Role | Variable | Use |
| --- | --- | --- |
| Display | `--display` (zh-Hant headings: `--heading`) | Headings, wordmark, big numbers and letters |
| Text | `--sans` | Everything else: body, labels, buttons, inputs |
| Accent | `--hand` | Short handwritten notes: eyebrows on the home page, captions, step numbers |

| Language | Display | Text | Accent |
| --- | --- | --- | --- |
| English | Iowan Old Style (Palatino Linotype on Windows) | Avenir Next (Trebuchet MS / Gill Sans) | Caveat |
| Traditional Chinese | Noto Serif TC for h1/h2, Noto Sans HK for other display text | Noto Sans HK | Aster Hand TC (subset of 辰宇落雁體 ChenYuluoyan 2.0 Thin) |
| Japanese | Hiragino Mincho ProN (Yu Mincho) | Hiragino Sans (Yu Gothic) | Hiragino Sans (no Japanese handwriting face yet) |
| Korean | AppleMyungjo (Batang) | Apple SD Gothic Neo (Malgun Gothic) | Nanum Pen Script (self-hosted subset) |

Caveat, Noto Serif TC and Noto Sans HK are self-hosted through `next/font`
(`src/app/layout.tsx`); the Chinese faces load only on Chinese pages. The
Korean and Chinese handwriting subsets live in `src/fonts/` with their
licences (see its README to regenerate them when handwritten copy changes).
ChenYuluoyan has no kana or Hangul, so Japanese and Korean keep their own
accent faces.

Scale and style:

- **Eyebrow / kicker:** 11px, weight 700, uppercase, letter-spacing 0.16em,
  `--fern`. The home page's softer sections use the handwritten accent
  instead (about 22–24px, `--fern`).
- **Section heading (h2):** display, weight 500, `clamp(28px, 3.4vw, 40px)`,
  letter-spacing −0.03em.
- **Page heading (h1):** display, weight 500, `clamp(34px, 4.6vw, 54px)` on
  inner pages, larger on the home hero.
- **Body:** text face, 15–16px, line-height 1.6, `--ink-soft`; max width
  about 62ch.
- **Labels:** 11px uppercase, letter-spacing 0.08em, weight 700.
- Non-English page headings tighten to line-height 1.04.

## Surfaces and layout

- **Page:** `--paper` with two faint warm and green radial glows and a 5px
  dot grain, so it reads as paper rather than flat beige.
- **Width:** content up to 1440px with a 5vw gutter (16px on phones); text
  pages `min(1120px, 100% − 40px)`.
- **Sections** are separated by the dashed rule, not boxes.
- **Cards and panels:** `--white` fill, 1px `--line` border (or 1px `--ink`
  for the one card that matters on a screen), radius 4–6px, no shadow.
- **Radius:** 3px inputs, 4px buttons and controls, 5–6px cards, fully round
  for pills, dots and avatars. Nothing larger than 12px on a rectangle.
- **Breakpoints:** 1120px, 780px (phone layout), 640px, 420px. Layouts stack
  to one column at 780px; no horizontal scrolling at any width.

## Components

- **Buttons:** 48px tall (58px large), 4px radius, 13px bold text with an
  arrow icon where it moves you forward.
  - Primary: `--ink` fill, `--white` text; hover `#245542`.
  - Secondary: translucent white fill with a `--line` border.
  - Ink: `--white` fill with `--ink` text, for use on the dark band.
  - Hover lifts 2px (motion only; no shadow). Disabled is 55% opacity.
  - One primary button per view.
- **Fields:** 52px tall, `--paper` fill, 1px `--line` border, 3px radius,
  uppercase 11px label above.
- **Type picker:** two-column rows of letter + plain-language description
  (E "Recharges around people"). Selected: `--moss` fill, 1px `--ink` border
  and a 1px inset outline.
- **Answer scale:** five square options (–– – ○ + ++) and a dashed "Not sure"
  option set slightly apart. Selected: `--ink` fill with white text;
  "Not sure" selected: `--lilac` fill.
- **Result bars:** a `--paper-deep` track with a midline. Friends are an ink
  dot, you are a `--lilac-deep` diamond; both sit on a paper-coloured
  outline so they read on the track. "Closely balanced" is a small lilac tag.
- **Photos ("snapshots"):** white-bordered prints, slightly rotated, held by
  a strip of `--tape`, with a handwritten caption.
- **Marker highlight:** an irregular `--marker` stroke under key words, at
  85% opacity and multiply, slightly rotated.
- **Handwritten step numbers:** `--marker` accent face, rotated −4°.
- **Admin console:** same tokens, denser tables, `--paper-deep` header rows;
  it is a tool, so no handwriting.

## Motion and accessibility

- Transitions are short (130–180ms ease): colour, background, a 2px lift.
- `prefers-reduced-motion` turns animation and smooth scrolling off.
- Focus ring: 3px solid lilac at 50% with a 3px offset, on links, buttons
  and inputs.
- Answer options are radio groups with arrow-key support and labels.
- Body text on paper stays dark green (`--ink-soft` or `--ink`); `--fern` is
  for short labels, not paragraphs.

## Words

- Four languages: English, Traditional Chinese, Japanese, Korean. Every
  visible string exists in all four (`src/lib/i18n.tsx`,
  `src/lib/bloom-i18n.ts`; tests check the keys match).
- Plain, warm, second person. Short sentences. Say what happens next ("We'll
  email you a six-digit code").
- Never present results as clinical: this is an informal reflection, not a
  validated personality test, and the copy says so where results appear.

## Email

`src/lib/email-template.ts`. Same look in a mail-safe form: tables, inline
styles, solid colours, a hidden inbox preview line, and a plain-text part.

- Cream page, `--white` card with a 1px line border and 6px radius, no
  shadow.
- The Aster mark (`public/email/aster-mark.png`) and wordmark above the card.
- Handwritten eyebrow, display-face heading, text-face body.
- The sign-in code sits in a dashed paper box with a marker underline.
- Milestone links are an `--ink` button with white text.
- Font stacks follow the same three roles per language. Gmail and Outlook
  can't load Caveat, so they show the fallback; that is expected.
- Sender: `EMAIL_FROM` in `wrangler.jsonc` (`hello-noreply@astereve.net`).

## Share images

`src/lib/share-image.tsx`: the 1080×1920 story card and the 1200×630 link
preview.

- Same palette (mirrored in `palette`).
- One serif and one sans per image, chosen by the language on it: Noto Serif
  and Sans TC/HK, JP or KR, fetched from Google Fonts and subset to exactly
  the characters drawn. The English faces are system fonts that can't be
  embedded, so Latin on images uses the Noto pair: the one place Latin
  differs from the site. Japanese text gets Japanese kanji forms, Korean
  Korean ones. A second pair loads only if the text contains a script the
  first cannot draw.
- No names of respondents on the story card.

## Before you ship a screen

- [ ] No shadows; separation comes from borders, rules, tone or space.
- [ ] Only `var(--display)`, `var(--sans)`, `var(--hand)` (or `--heading`).
- [ ] Colours from tokens.
- [ ] Handwriting only on static copy.
- [ ] Copy in all four languages.
- [ ] Works at 375px wide with no horizontal scroll; tap targets at least
      44px.
- [ ] Focus ring visible; keyboard works.
