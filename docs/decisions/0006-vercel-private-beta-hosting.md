# 0006 — Vercel private-beta hosting

- **Status:** Accepted
- **Date:** 29 September 2026

## Context

The private-beta project was created on Vercel. Its first deployment served the Vite frontend, but `/api/v1/*` returned `404` because the Express application was not exposed as a Vercel Function.

## Decision

Deploy Play Spark as one Vercel project and one web origin. Vercel serves the Vite production build and routes `/api/v1/*` to a single Express function adapter. The adapter reuses the existing Express application, API routes, authentication, validation, and MongoDB repositories; it does not create a second backend or expose database access to the browser.

Keep the conventional Node listener for local development and portable hosting. Store all production credentials in Vercel environment variables and seed the beta database outside the deployment build.

## Consequences

- The React application and API remain available under the same origin, so secure cookie sessions do not require CORS.
- Vercel Functions may scale to multiple instances; the database provider must continue to reuse connections within each warm instance.
- In-memory rate limiting is instance-local and must be replaced with shared limiting before a wider public launch.
- MongoDB Atlas must allow network access from the chosen Vercel runtime arrangement while retaining a dedicated least-privilege beta database user.
