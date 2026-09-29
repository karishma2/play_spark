# Play Spark

Private-beta foundation for a screen-free preschool activity planner.

## Phase 0: connection check

1. Create the `play_spark_dev` database and a dedicated least-privilege Atlas database user.
2. Copy `.env.example` to `.env`, add the development connection string, and add a random `SESSION_SECRET` of at least 32 characters. Do not commit it.
3. In one terminal, run `npm run dev:api`. In a second terminal, run `npm run dev`.
4. Call `GET /api/v1/connection-check` through the React development address.

The endpoint returns only `connected`, `not_configured`, or a generic unavailable error. It never returns a connection string or low-level database error.

## Seed the activity catalogue

After configuring the development MongoDB connection in `.env`, seed the reviewed guest Play Paths with:

```powershell
npm run seed:catalog
```

Prepare the parent-account collections and indexes before testing sign-up:

```bash
npm run setup:auth
```

Prepare the child-profile collections and seed the reviewed onboarding choices:

```bash
npm run seed:profiles
```

The catalogue command validates `content/guest-samples.json`, creates or updates the approved catalogue collections and indexes, and upserts stable records. The profile command does the same for the curated interests and play styles in `content/profile-options.json`. Both seed commands are safe to run again after reviewed content changes.

## Password reset email

Set `APP_BASE_URL` to the public frontend origin used in verification and password-reset links. For local development this is normally `http://localhost:5173`. To send account emails, configure both `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; use Resend's testing sender during local development or a verified domain for deployed environments. Restart the API after changing these values, then run `npm run setup:auth` to create the authentication token collections and indexes and mark accounts created before email verification as verified.

## Commands

```text
npm install
npm run check
npm test
npm run build
npm run start
```

## Vercel deployment

The repository includes a Vercel function adapter and same-origin routing. Vercel builds the Vite frontend into `dist` and sends `/api/v1/*` to the existing Express application.

Configure these Vercel environment variables for Production and Preview as appropriate:

- `MONGODB_URI`
- `MONGODB_DB_NAME` (`play_spark_beta` for the private beta)
- `SESSION_SECRET` (at least 32 characters and different from development)
- `APP_BASE_URL` (the stable HTTPS Vercel production URL)
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` together when account email is enabled

Do not seed during the Vercel build. Before beta use, run `npm run setup:auth`, `npm run seed:catalog`, and `npm run seed:profiles` once from an authorized environment configured for the beta database. All commands are repeatable.

Generate a local session secret without sharing it:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Vercel automatically deploys previews from feature branches and production from the configured production branch.
