# Play Spark

Private-beta foundation for a screen-free preschool activity planner.

## Phase 0: connection check

1. Create the `play_spark_dev` database and a dedicated least-privilege Atlas database user.
2. Copy `.env.example` to `.env` and add the development connection string locally. Do not commit it.
3. In one terminal, run `npm run dev:api`. In a second terminal, run `npm run dev`.
4. Call `GET /api/v1/connection-check` through the React development address.

The endpoint returns only `connected`, `not_configured`, or a generic unavailable error. It never returns a connection string or low-level database error.

## Commands

```text
npm install
npm run check
npm run build
npm run start
```

For Render, use `npm run build` as the build command and `npm run start` as the start command. Add `MONGODB_URI` and `MONGODB_DB_NAME` as Render environment variables; neither is stored in this repository.
