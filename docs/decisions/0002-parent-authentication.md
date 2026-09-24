# 0002 — Parent authentication foundations

**Status:** Accepted  
**Date:** 24 September 2026

## Decision

- Use the asynchronous Node.js `crypto.scrypt` implementation with a unique random salt and a versioned stored hash format for parent passwords.
- Use 32-byte random opaque session tokens. Store only their SHA-256 hashes in MongoDB.
- Keep sessions server-side for 14 days in `authSessions`, with a TTL index on `expiresAt`.
- Use an `HttpOnly`, `SameSite=Lax` cookie. Enable `Secure` in deployed environments and allow a documented local/test exception for HTTP development.
- Use React Router for stable authentication, guest-preview, and onboarding URLs.

## Rationale

Node 20 includes scrypt, so the application can use a memory-hard password function without a native runtime dependency. Server-side opaque sessions support immediate sign-out and future account-wide invalidation. Stable routes are now necessary for authentication and later password-reset links.

## Consequences

- Password hashes include their algorithm and work parameters so they can be upgraded later.
- Authentication requires MongoDB; there is no runtime account fallback.
- Password-reset email delivery remains a separate Phase 2.2 decision.
