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

## Deploy with durable storage

Aster automatically uses Neon Postgres whenever `DATABASE_URL` is set and keeps
SQLite as the zero-configuration local fallback. On its first database request,
the server creates the relational schema and idempotently seeds the versioned
200-question bank.

For Vercel, connect a Neon database from the Storage marketplace, ensure the
generated `DATABASE_URL` is available to Production and Preview, then deploy.
Do not deploy the SQLite fallback to a serverless host because its filesystem is
ephemeral.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

Aster is an MBTI-style reflection tool. It is not affiliated with or endorsed by The Myers-Briggs Company.
