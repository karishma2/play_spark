# Play Spark — Implementation Plan

**Status:** Working delivery plan derived from the approved product, architecture, database, ERD, and API documents.

This document describes delivery order and acceptance criteria. Approved architecture and API documents remain authoritative for system behavior.

## Delivery principles

- Build vertical product slices that include the applicable UI, API, validation, data or content, and tests.
- Keep each feature independently reviewable on its own branch.
- Introduce folders and abstractions when a real feature needs them; do not create speculative empty structure.
- Translate Stitch designs into reusable React components and design tokens rather than copying generated HTML wholesale.

## Phase plan

| Phase | Outcome | Depends on |
|---|---|---|
| 0 — Foundation | React/Express application, safe configuration, MongoDB connectivity, tests, and production build | None |
| 1 — Guest experience | Landing page and two complete browser-only sample Play Paths | Phase 0 |
| 1.1 — Activity catalogue persistence | MongoDB-backed guest Play Paths, missions, Mission Wall scenes, and repeatable content seeding | Phase 1 |
| 2 — Parent accounts | Sign-up, sign-in, sign-out, password management, and secure server-side sessions | Phase 0 |
| 3 — Child onboarding | One active beta child profile with curated interests and play styles | Phase 2 |
| 4 — Discovery | Dashboard, filters, rule-based recommendations, and Play Path details | Phases 1 and 3 |
| 5 — Active play | Session start/resume, mission completion, skip, replacement, and completion | Phase 4 |
| 6 — Progress and retention | Mission Wall, favourites, history, and fixed-choice feedback | Phase 5 |
| 7 — Private-beta readiness | Account deletion, analytics, accessibility review, deployment, backup, and operational checks | Phases 2–6 |

## Phase 2 — Parent accounts and secure authentication

Phase 2 is delivered as two independently reviewable vertical slices.

### Phase 2.1 — Parent account access

**Branch:** `feature/parent-account-access`

#### Scope

- Add stable client routes for account access and the existing guest experience.
- Enable parent sign-up, sign-in, sign-out, and session restoration.
- Store normalized parent accounts and hashed opaque browser sessions in MongoDB.
- Use a 14-day `HttpOnly`, `SameSite=Lax` cookie, with `Secure` enabled outside local development and tests.
- Send a newly authenticated parent without a child profile to the Phase 3 onboarding boundary.
- Keep existing guest progress browser-only.

#### Acceptance criteria

- A parent can create an account with a unique normalized email and a password of 10–128 characters.
- A parent can sign in without the response revealing whether the submitted email exists.
- Refreshing the browser restores a valid account session without exposing the session token to JavaScript.
- Signing out deletes the matching server-side session immediately and clears the cookie.
- Expired, missing, and invalid sessions receive the documented `UNAUTHENTICATED` response.
- Authentication input is validated with Zod and sign-up/sign-in remain rate limited.
- MongoDB validators and indexes enforce unique emails, unique token hashes, and automatic session expiry.
- Existing guest journeys continue to work and `npm run verify` passes.

### Phase 2.2 — Password management

**Proposed branch:** `feature/password-management`

- Change a password after verifying the current password.
- Request a non-enumerating password-reset email.
- Confirm a single-use reset token that expires after 30 minutes.
- Invalidate other sessions on password change and all sessions on forgotten-password reset.
- Add the reviewed email provider through a small server-side adapter.

## Phase 1 — Landing page and guest sample experience

**Proposed branch:** `feature/guest-experience`

**Stitch reference:** Project `Play Spark Activity Planner`; `Landing & Exploration` (`b5d36294b3a440e8a46839b3840fdb67`), `Guest Preview - Try Before Sign-Up` (`873c83f9a0d64e059b6de77c387a2f0d`), `Play Path Detail` (`56c6db2af09c41c1ae87b9e3412ae4fc`), and the guest `Active Play Session` (`89dfc5566c46459c84f4310af1d0f8a0`).

### Scope

- Establish shared design tokens and foundational UI components from the approved Stitch design system.
- Build the responsive landing and exploration experience.
- Provide two curated sample Play Paths with ordered missions.
- Give each sample a detail overview and a browser-only active session that presents one mission at a time.
- Implement `GET /api/v1/guest/samples` and `GET /api/v1/guest/samples/:sampleId`.
- Keep guest progress and sample-completion count in browser storage.
- Present an account invitation after two completed samples.

### Acceptance criteria

- A visitor understands the product purpose and can choose either sample without signing in.
- A visitor can read and complete every mission in a sample Play Path.
- Starting a sample moves from its detail overview into a focused active session and advances one mission at a time.
- Guest progress is never written to MongoDB.
- Refreshing the browser preserves the local two-sample count.
- Completing the second sample shows the account invitation.
- Invalid or unavailable sample identifiers return the documented safe API error.
- The experience works at relevant mobile and desktop sizes and meets the applicable Definition of Done.

## Later-phase preparation

## Phase 1.1 — Activity catalogue persistence

**Branch:** `feature/activity-catalog`

### Scope

- Store published guest Play Paths, missions, their ordering, and Mission Wall scenes in the approved MongoDB collections.
- Seed the two reviewed guest samples through a repeatable, schema-validated command.
- Read both guest sample endpoints from MongoDB without a runtime hardcoded-content fallback.
- Keep guest completion progress in browser storage; this phase persists developer-managed content only.
- Return safe API errors when the catalogue database is unavailable or a sample is not published.

### Acceptance criteria

- Re-running the seed command updates the same catalogue records without creating duplicates.
- The guest list returns only published, enabled samples in their configured order and omits mission details.
- The guest detail endpoint returns published missions in Play Path order with matching Mission Wall elements.
- Invalid, unpublished, or unknown identifiers return the documented safe not-found response.
- Database failures do not expose connection details or low-level errors.
- MongoDB validators and indexes enforce the essential catalogue invariants.
- Guest progress remains browser-only, and the existing guest journey behaves the same after seeding.

Before each later phase begins, expand its scope into feature-level acceptance criteria and record any required dependency decision. Likely decisions include client routing, password hashing, browser testing, email delivery, analytics integration, and production session cleanup.
