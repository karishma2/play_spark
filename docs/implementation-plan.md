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
| 1 — Guest experience | Landing page and complete browser-only sample Play Paths | Phase 0 |
| 1.1 — Activity catalogue persistence | MongoDB-backed guest Play Paths, missions, Mission Wall scenes, and repeatable content seeding | Phase 1 |
| 2 — Parent accounts | Sign-up, sign-in, sign-out, password management, and secure server-side sessions | Phase 0 |
| 3 — Child onboarding | One active beta child profile with curated interests and play styles | Phase 2 |
| 4 — Discovery | Dashboard, filters, rule-based recommendations, and Play Path details | Phases 1 and 3 |
| 5 — Active play | Session start/resume, mission completion, skip, replacement, and completion | Phase 4 |
| 6 — Progress and retention | Mission Wall, favourites, history, and fixed-choice feedback | Phase 5 |
| 7 — Private-beta readiness | Account deletion, analytics, accessibility review, deployment, backup, and operational checks | Phases 2–6 |

## Phase 3 — Child-profile onboarding and editing

Phase 3 is delivered as two independently reviewable vertical slices.

### Phase 3.1 — Child onboarding

**Branch:** `feature/child-onboarding`

#### Scope

- Let a verified parent create one active beta child profile using an optional nickname, birth month/year, curated interests, and curated play styles.
- Store profile options in MongoDB and manage them through a repeatable, schema-validated seed file.
- Implement `GET /api/v1/profile-options`, `POST /api/v1/child-profile`, and `GET /api/v1/child-profile` with session, configured verification policy, ownership, and safe-error checks.
- Calculate and validate the supported 3–5 age range on the server without collecting a full birth date.
- Replace the onboarding placeholder with a responsive, keyboard-usable guided flow and a completion screen that links back to sample activities.

#### Acceptance criteria

- Only a signed-in, email-verified parent can create or read a child profile.
- A parent can save one active beta profile with an optional nickname, valid birth month/year, at least one supported interest, and at least one supported play style.
- Unsupported option keys, duplicate keys, future dates, and ages outside 3–5 receive safe field errors.
- A second or concurrent creation attempt returns `CONFLICT` without creating a duplicate profile.
- Parent ownership is derived from the secure session; profile ownership fields are never accepted from the browser.
- Curated options are returned from MongoDB in reviewed order and can be reseeded without duplicates.
- Saving onboarding updates restored session state so `hasChildProfile` is true.
- Database failures return safe errors, existing guest/authentication journeys continue to work, and the applicable Definition of Done is met.

### Phase 3.2 — Child-profile editing

**Proposed branch:** `feature/child-profile-editing`

#### Scope

- Implement `PATCH /api/v1/child-profile` for the existing parent-owned editable fields.
- Add an authenticated profile screen for reviewing and updating the active profile.
- Apply changes to future recommendations without rewriting historical activity sessions.

#### Acceptance criteria

- A verified signed-in parent with an active child profile can review and update its nickname, birth month/year, interests, and play styles.
- The API derives ownership from the secure session, updates only that parent's active profile, and never accepts an ownership identifier from the browser.
- Updates reuse onboarding validation for supported ages, curated option keys, required choices, and duplicate choices.
- Removing the optional nickname clears it from the stored profile, while the profile identity remains unchanged.
- Missing profiles, unauthenticated access, accounts blocked by the configured verification policy, invalid input, and database failures return safe responses.
- The profile screen provides loading, retry, validation, cancel, success, and responsive states and explains that changes affect future recommendations only.
- Existing onboarding, authentication, guest activity, and historical activity behavior remains unchanged.

## Phase 4 — Discovery

Phase 4 is delivered as two independently reviewable vertical slices.

### Phase 4.1 — Rule-based personalized recommendations

**Branch:** `feature/personalized-recommendations`

#### Scope

- Implement authenticated `POST /api/v1/recommendations` using the active child profile and published Play Path eligibility data.
- Validate the immediate situation: 10, 20, or 30 available minutes; current energy; practical constraints; and an optional theme.
- Rank age-suitable content deterministically by interests, play styles, current energy, theme, time, and constraints.
- Return at most three useful recommendation cards with an exact or best-available label and a short parent-facing explanation.

#### Acceptance criteria

- Only a signed-in parent allowed by the configured email-verification policy and owning an active child profile can request recommendations.
- Child age eligibility is mandatory and ownership is always derived from the secure session.
- Exact matches are ranked ahead of fallback matches; ties have stable deterministic ordering.
- When immediate preferences cannot all be met, age-suitable best-available results identify the relaxed preference instead of returning an empty screen.
- Invalid input, missing profiles, unauthenticated access, verification-policy failures, and storage failures return safe API errors.
- Recommendation logic remains in a dedicated server module and has focused ranking and route coverage.

### Phase 4.2 — Parent discovery dashboard

#### Scope

- Replace the signed-in full-catalogue landing state with a focused parent discovery dashboard.
- Let the parent choose available time, current energy, practical constraints, and an optional interest before refreshing recommendations.
- Present recommendation reasoning, purpose, materials, effort, setup time, and exact or best-available status.
- Open recommended content through the authenticated Play Path detail boundary while leaving guest discovery unchanged.

#### Acceptance criteria

- A signed-in parent with an active child profile receives recommendations on the dashboard without seeing guest account prompts.
- Changing and submitting discovery choices refreshes the ranked results while preserving clear loading, retry, and no-result states.
- Recommendation cards explain why an activity was selected and clearly label relaxed-preference results.
- Selecting a recommendation opens the complete age-suitable Play Path detail through an authenticated API route.
- The discovery dashboard remains keyboard usable and responsive at supported mobile and desktop widths.

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
- Send a 24-hour, single-use verification link after sign-up and allow a rate-limited replacement link.
- Allow unverified parents to browse guest activities while requiring verification before child-profile onboarding.
- Treat accounts created before email verification as verified during the authentication schema update.
- Allow the controlled private beta to disable the verification gate explicitly until a production sending domain is available; preserve verification for later activation and exempt accounts created under the beta policy.

## Phase 1 — Landing page and guest sample experience

**Proposed branch:** `feature/guest-experience`

**Stitch reference:** Project `Play Spark Activity Planner`; `Landing & Exploration` (`b5d36294b3a440e8a46839b3840fdb67`), `Guest Preview - Try Before Sign-Up` (`873c83f9a0d64e059b6de77c387a2f0d`), `Play Path Detail` (`56c6db2af09c41c1ae87b9e3412ae4fc`), and the guest `Active Play Session` (`89dfc5566c46459c84f4310af1d0f8a0`).

### Scope

- Establish shared design tokens and foundational UI components from the approved Stitch design system.
- Build the responsive landing and exploration experience.
- Provide a curated set of sample Play Paths with ordered missions.
- Give each sample a detail overview and a browser-only active session that presents one mission at a time.
- Implement `GET /api/v1/guest/samples` and `GET /api/v1/guest/samples/:sampleId`.
- Keep guest progress and sample-completion count in browser storage.
- Present an account invitation after two completed samples.

### Acceptance criteria

- A visitor understands the product purpose and can choose either sample without signing in.
- A visitor can read and complete every mission in a sample Play Path.
- Starting a sample moves from its detail overview into a focused active session and advances one mission at a time.
- Guest progress is never written to MongoDB.
- Refreshing the browser preserves local sample completion progress.
- Completing the second sample shows the account invitation.
- Invalid or unavailable sample identifiers return the documented safe API error.
- The experience works at relevant mobile and desktop sizes and meets the applicable Definition of Done.

## Later-phase preparation

## Phase 1.1 — Activity catalogue persistence

**Branch:** `feature/activity-catalog`

### Scope

- Store published guest Play Paths, missions, their ordering, and Mission Wall scenes in the approved MongoDB collections.
- Seed the reviewed guest samples through a repeatable, schema-validated command.
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
