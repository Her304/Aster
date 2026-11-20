# Aster

A private, account-free reflection room where friends compare how they see one another.

## Included in the MVP

- Private invitation-code rooms and nickname-based participation
- Secure cookie sessions plus a private cross-device recovery link
- A 200-item original question bank and a balanced, versioned 50-question survey
- Ten-question pages with automatic saving and resumable progress
- Separate friend and optional self-assessments
- Server-side scoring, equal reviewer weighting, midpoint balance flags, and automatic reveal
- Named individual perspectives, exact dimension scores, self-comparison, and room summary
- Responsive landing, lobby, dashboard, survey, waiting, and results experiences
- English, Traditional Chinese, Japanese, and Korean interface and survey copy

## Open surveys

Besides private circles, anyone can start an open survey at `/bloom` and share
one link (`/s/<code>`):

- The person who starts it signs in with a six-digit code sent by email; no password.
- Anyone with the link answers 16 questions about them with just a name and how
  they know them. A per-browser cookie remembers that they answered, so they can
  return for the updated ranking; signing in later attaches their answers to
  their account.
- Respondents see the ranking, without names, once three people have answered.
- The initiator sees who answered, a private report (letters, question-by-question
  gaps from five answers, view by relationship from eight), and can copy a
  prompt for another AI that contains no names.

- Gap badges (such as "Undercover introvert" or "Chameleon") name the shape of
  the difference, and the initiator can share a story-sized result card.
- Each survey link has its own preview image when pasted into a chat.
- Once ten people have answered, every respondent earns a watercolour flower
  by how closely their answers match the initiator's own type: globe amaranth
  (84–100%), blue iris (50–83%), iris (25–49%) or hydrangea (0–24%).
  Respondents see their flower and its meaning in the language of flowers;
  the initiator sees each respondent's flower beside their name, a guide to
  all four with how many earned each, and the flowers painted behind the
  result card. Initiators who opted in get an email when the flowers open.
- From five answers, the AI prompt lists the three questions respondents
  disagreed on most, with their combined counts.
- The initiator's page has a garden: every answer plants one of twelve painted
  asters, and tapping a flower shows who planted it and the type they chose.
- Initiators can opt in to an email when the ranking (3 answers), the
  question-by-question comparison (5) and the view by relationship (8) open.

Sign-in and notification email needs `RESEND_API_KEY` and `EMAIL_FROM` (see
`.env.example`). In local development without them, emails and codes are
printed to the server console. Share images fetch their fonts from Google Fonts
when generated.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data is stored locally in `data/aster.db` using SQLite.

## Deploy to Cloudflare Workers

Aster runs on Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`), configured in `wrangler.jsonc` and
`open-next.config.ts`. Workers have no filesystem, so production needs Neon
Postgres: set `DATABASE_URL`, and the server creates the schema and seeds the
question bank on its first database request.

In the Cloudflare dashboard, open the Worker, then **Settings → Build**:

| Setting | Value |
| --- | --- |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Non-production branch deploy command | `npx opennextjs-cloudflare upload` |

Do not point the build command at `npm run build`: that runs plain
`next build`, which never produces `.open-next/worker.js`.

The Worker's name must match `name` in `wrangler.jsonc` (`aster`). Under
**Settings → Variables and Secrets**, add the pooled Neon `DATABASE_URL` (host
contains `-pooler`) and, for email, `RESEND_API_KEY` and `EMAIL_FROM` as
secrets. Optional analytics: set `NEXT_PUBLIC_CF_BEACON_TOKEN` at build time to
load the Cloudflare Web Analytics beacon.

From a terminal:

```bash
cp .dev.vars.example .dev.vars   # then fill in DATABASE_URL
npx wrangler login               # one-time browser auth
npm run preview                  # build + run the Worker locally
npm run deploy                   # ship to Cloudflare
```

Aster still runs on any Node host (`npm run build && npm start`), using Neon
when `DATABASE_URL` is set and local SQLite otherwise. Do not deploy the SQLite
fallback to a serverless host: its filesystem is ephemeral.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

Aster is an MBTI-style reflection tool. It is not affiliated with or endorsed by The Myers-Briggs Company.
