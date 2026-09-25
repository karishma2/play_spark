# Play Spark — Development Progress

**Purpose:** This file is the durable record of what has been built, verified, and left for later. Read it with the approved architecture, database, ERD, API, and development-workflow documents before starting feature work.

**Last updated:** 25 September 2026

## Status meanings

| Status | Meaning |
|---|---|
| `Planned` | Agreed future work that has not started. |
| `In progress` | Work exists on a feature branch but is not complete. |
| `Blocked` | Work cannot continue until a named decision or dependency is resolved. |
| `Complete` | Agreed scope is implemented and relevant checks pass. |

## Phase overview

| Phase | Scope | Status |
|---|---|---|
| 0 | Application and server foundation | Complete |
| 1 | Landing page and guest sample experience | Complete |
| 1.1 | MongoDB-backed activity catalogue and seeding | Complete |
| 2 | Parent accounts and secure authentication | Complete |
| 3 | Child-profile onboarding and editing | Planned |
| 4 | Dashboard, filters, and rule-based recommendations | Planned |
| 5 | Active Play Sessions and mission actions | Planned |
| 6 | Mission Wall, favourites, history, and feedback | Planned |
| 7 | Private-beta hardening, analytics, and deployment | Planned |

## Completed features

### Password management and email verification

- **Status:** Complete
- **Branch:** `feature/password-management`
- **Completed:** 25 September 2026
- **Delivered:**
  - Authenticated password changes that verify the current password, reject reuse, preserve the current session, and invalidate other sessions.
  - Privacy-safe password-reset requests with 30-minute, single-use hashed tokens and invalidation of all sessions after reset.
  - Resend-backed authentication email delivery through a provider-neutral server adapter and validated environment configuration.
  - Verification emails for new accounts using 24-hour, single-use hashed tokens; requesting a replacement invalidates the earlier link.
  - Guest activity access for unverified parents with onboarding and future parent-owned features held behind an email-verification checkpoint.
  - Safe migration of pre-existing accounts as verified without allowing later setup runs to verify new accounts accidentally.
  - Responsive password and verification screens with safe loading, success, invalid-link, validation, and provider-unavailable states.
  - The landing-page “No sign-in needed” helper now appears only for confirmed signed-out visitors.
- **Key files or routes:** `server/auth.ts`, `server/email.ts`, `src/EmailVerificationPage.tsx`, `src/PasswordPage.tsx`, `POST /api/v1/auth/request-email-verification`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/request-password-reset`, `POST /api/v1/auth/reset-password`
- **Validation:** `npm run verify` passed before review fixes with TypeScript checks, catalogue validation, 23 automated tests, the production build, and the progress guard. After the review and testing fixes, `npm run check` and 10 focused authentication tests pass. Authentication collection setup completed against `play_spark_dev`. Password-reset and verification screens were visually inspected at desktop and 390 px widths. Resend accepted a delivery through the configured API key and testing sender.
- **Follow-up:** Configure and verify a production sending domain before accepting external beta accounts; Resend's development sender restricts recipients.
- **Feature-log note:** Review and testing fixes persist the new-account verification marker, make forgotten-password updates and session revocation transactional, return reset-request responses independently of account lookup and email-delivery latency, and isolate rate-limit budgets by authentication action.

### Parent account access

- **Status:** Complete
- **Branch:** `feature/parent-account-access`
- **Completed:** 24 September 2026
- **Delivered:**
  - Parent sign-up and sign-in with normalized unique emails and scrypt password hashes.
  - Opaque 14-day server-side sessions with hashed tokens, secure cookie settings, immediate sign-out, and browser session restoration.
  - MongoDB validators and indexes for `users` and `authSessions`, including unique and TTL indexes plus a repeatable setup command.
  - Stable `/sign-up`, `/sign-in`, `/guest-preview`, and `/onboarding` routes using React Router.
  - Responsive account screens, enabled guest account actions, and an authenticated Phase 3 onboarding boundary.
  - Signed-in sample browsing that preserves the parent session and suppresses the guest account invitation.
  - Account-aware sample-page messaging that removes sign-up and sign-in prompts for authenticated parents.
  - Protection against a pending session-restoration request overwriting a newly completed sign-in.
  - Failed sign-out attempts preserve the visible authenticated session and provide a safe retry message.
  - Browser history navigation back to landing or sample browsing clears stale and in-flight sample details.
  - Safe validation, duplicate-account, invalid-credential, unauthenticated, and database-unavailable responses.
- **Key files or routes:** `server/auth.ts`, `server/setupAuth.ts`, `src/AuthPage.tsx`, `POST /api/v1/auth/sign-up`, `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/sign-out`, `GET /api/v1/auth/session`
- **Validation:** `npm run verify` passes TypeScript checks, catalogue validation, 19 automated tests, the production build, and the progress guard. `npm audit --omit=dev` reports no production vulnerabilities. Authentication collections were prepared in `play_spark_dev`; the sign-up and sign-in screens were checked at desktop and 390 px mobile widths. Independent review passed after its three findings were fixed. Independent feature testing verified signed-in sample browsing, hidden guest account prompts, home-navigation cleanup, and session preservation with a safe retry message when sign-out fails.
- **Follow-up:** Password change, session invalidation after credential changes, and forgotten-password reset remain Phase 2.2.
- **Feature-log note:** Finalization fixed account-prompt flashes during session restoration, removed runtime schema-management work from authentication requests, and cleared stale form state when switching between sign-up and sign-in.
- **Feature-log note:** The landing-page “No sign-in needed” helper is shown only after confirming the visitor is signed out, so authenticated parents do not see guest-only guidance.

### MongoDB-backed activity catalogue

- **Status:** Complete
- **Branch:** `feature/activity-catalog`
- **Completed:** 23 September 2026
- **Delivered:**
  - MongoDB-backed guest sample list and detail queries using normalized Play Paths, missions, ordering links, and Mission Wall scenes.
  - Schema-validated, repeatable seed content for the two reviewed guest samples.
  - Essential MongoDB collection validators and catalogue indexes.
  - Database-owned Mission Wall labels and reveal messages while completion progress remains browser-only.
  - One-time migration of browser progress from the former readable sample and mission identifiers to catalogue ObjectIds.
  - Conflict-free reseeding when existing guest samples exchange display positions.
  - Safe not-found and catalogue-unavailable API responses.
- **Key files or routes:** `content/guest-samples.json`, `server/seedCatalog.ts`, `server/catalog.ts`, `GET /api/v1/guest/samples`, `GET /api/v1/guest/samples/:sampleId`
- **Validation:** `npm run verify` passes catalogue validation, TypeScript checks, 14 automated tests, the production build, and the progress guard. The seed completed repeatedly against `play_spark_dev`; the live API returned two samples and three ordered missions for the first sample.
- **Follow-up:** Replace the remote prototype activity images with owned production assets before public release.

### Application and server foundation

- **Status:** Complete
- **Branch:** `main`
- **Commits:** `29df632`, `4d15005`
- **Completed:** 21 September 2026
- **Delivered:**
  - React, TypeScript, and Vite frontend scaffold.
  - Node.js and Express API served from the same application.
  - MongoDB client provider with a shared lazy connection and safe retry after connection failure.
  - Environment validation for the port and session secret.
  - Security headers, JSON request-size limits, authentication rate-limit middleware, and safe API error handling.
  - `GET /api/v1/health` and safe `GET /api/v1/connection-check` endpoints.
  - Production build and static frontend serving through Express.
  - Type checking, server tests, and build scripts.
- **Key files:** `src/`, `server/`, `tests/`, `package.json`, `vite.config.ts`
- **Validation:** Existing foundation test and build commands were established in the scaffold. Run them again before beginning Phase 1.
- **Follow-up:** Replace the placeholder frontend with the first approved product experience.

### Development workflow automation

- **Status:** Complete
- **Branch:** `feature/development-workflow`
- **Commit:** `72fa13b`
- **Completed:** 22 September 2026
- **Delivered:** Workflow documentation, Definition of Done, phased implementation plan, decision-log templates, pull-request checklist, unified local verification, GitHub Actions verification, and an automated progress-file guard.
- **Key files:** `AGENTS.md`, `docs/`, `.github/`, `scripts/check-progress-update.mjs`, `package.json`
- **Validation:** `npm run verify` passes: TypeScript checks, 5 automated tests, production build, and progress-file guard.
- **Follow-up:** None.

### Landing page and guest sample experience

- **Status:** Complete
- **Branch:** `feature/guest-experience`
- **Completed:** 23 September 2026
- **Reference:** Stitch project `Play Spark Activity Planner`, especially the `Landing & Exploration` and `Guest Preview - Try Before Sign-Up` screens.
- **Delivered:**
  - Responsive landing page based on the approved Stitch design direction.
  - Equal-height Quick Spark cards with consistently aligned action buttons.
  - Separate responsive guest-preview screen based on the approved Stitch reference while retaining API-provided sample content.
  - Play Path overview with preparation facts, materials, the three-mission journey, and a clear start action.
  - Focused browser-only active session that presents and completes one mission at a time.
  - Mission Wall preview plus a persistent completion moment that reveals one themed scene element with a subtle, reduced-motion-safe animation and waits for the parent to continue.
  - Fresh Mission Wall progress when a completed Play Path is replayed.
  - Two curated guest Play Paths with materials, safety guidance, and three ordered missions each.
  - Browser-only mission and sample progress that survives reloads.
  - Account invitation after both guest samples are complete.
  - Safe guest sample list and detail API endpoints.
- **Key files or routes:** `src/App.tsx`, `src/styles.css`, `src/guestProgress.ts`, `server/catalog.ts`, `GET /api/v1/guest/samples`, `GET /api/v1/guest/samples/:sampleId`
- **Validation:** `npm run verify` passes TypeScript checks, 11 automated tests, the production build, and the progress guard. The complete guest-preview → detail → active-session journey, all three mission-specific Mission Wall reveals, replay reset, final completion, reload persistence, desktop layout, and 390 px mobile layout were checked manually.
- **Follow-up:** Phase 1.1 replaced the temporary runtime sample array with the MongoDB-backed catalogue. Add a dedicated `/guest-preview` route when application routing is introduced, and replace the remote prototype activity images with owned production assets before public release.

## Feature log template

Copy this section when a feature begins. Update it before the feature commit.

```markdown
### Feature name

- **Status:** Planned | In progress | Blocked | Complete
- **Branch:** `feature/example`
- **Commit:** Add after committing
- **Completed:** YYYY-MM-DD, or omit until complete
- **Delivered:** Brief list of user-visible behavior and important technical work
- **Key files or routes:** Relevant paths and API endpoints
- **Validation:** Commands or manual checks that passed
- **Follow-up:** Remaining work, known limitations, or `None`
```
