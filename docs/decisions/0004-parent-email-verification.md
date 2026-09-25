# 0004 — Parent email verification

- **Status:** Accepted
- **Date:** 25 September 2026

## Context

Parent accounts will own child profiles and other private data in later phases. Play Spark needs to establish that a new parent controls the submitted email address before allowing onboarding, while retaining access to the public guest experience.

## Decision

Send a verification link immediately after sign-up through the existing server-side authentication email adapter. Store only the SHA-256 hash of a cryptographically random token. Keep one active token per account; issuing a replacement invalidates the earlier link. Tokens expire after 24 hours and are claimed once with an atomic database update.

An unverified parent remains signed in and may browse guest activities, request a replacement verification email, change their password, or sign out. Child-profile onboarding and future parent-owned features require a verified email. Password-reset emails are sent only for verified accounts, while the request endpoint retains its account-neutral response.

Accounts created before this feature are marked verified by the repeatable authentication setup. New users carry an explicit `emailVerificationRequired` marker so rerunning setup cannot accidentally verify them.

## Consequences

- The session response includes `emailVerified`, allowing the frontend to enforce the onboarding boundary.
- Deployed environments must configure working authentication email delivery before accepting new accounts.
- Verification delivery, replacement, expiry, and invalid-link states require focused testing alongside password management.
