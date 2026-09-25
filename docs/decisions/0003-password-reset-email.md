# 0003 — Resend password-reset email adapter

- **Status:** Accepted
- **Date:** 25 September 2026

## Context

Phase 2.2 requires password-reset email without placing provider details in authentication business logic or exposing reset tokens to the frontend API response. The provider choice and credential handling affect security and deployment configuration.

## Decision

Use Resend through a small server-side `AuthEmailSender` adapter and the native Node.js `fetch` API. Configure the adapter with `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; neither value is available to browser code. Build reset links from the validated `APP_BASE_URL` setting. The adapter also supports the subsequently approved email-verification flow.

Store only SHA-256 hashes of cryptographically random reset tokens in MongoDB. Tokens expire after 30 minutes, are claimed once with an atomic database update, and never appear in application logs or API responses. Reset requests return the same accepted response whether an account exists or delivery succeeds.

## Consequences

- Authentication routes and tests can use the provider-neutral interface.
- No provider SDK dependency is required.
- Deployed environments must configure a verified Resend sender and the correct public application URL.
- Delivery failures remain private to preserve account non-enumeration; operational monitoring can be added later without recording recipient addresses or tokens.
