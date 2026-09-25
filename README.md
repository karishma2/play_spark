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

The command validates `content/guest-samples.json`, creates or updates the approved catalogue collections and indexes, and upserts stable records. It is safe to run again after reviewed content changes.

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

For Render, use `npm run build` as the build command and `npm run start` as the start command. Add `MONGODB_URI` and `MONGODB_DB_NAME` as Render environment variables; neither is stored in this repository.

Generate a local session secret without sharing it:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Render also requires `SESSION_SECRET`; it must be a different value from the development secret.
