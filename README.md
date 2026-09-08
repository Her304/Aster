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
