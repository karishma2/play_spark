# Play Spark — Development Progress

**Purpose:** This file is the durable record of what has been built, verified, and left for later. Read it with the approved architecture, database, ERD, API, and development-workflow documents before starting feature work.

**Last updated:** 9 October 2026

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
| 3 | Child-profile onboarding and editing | Complete |
| 4 | Dashboard, filters, and rule-based recommendations | Complete |
| 5 | Active Play Sessions and mission actions | Complete |
| 6 | Mission Wall, favourites, history, and feedback | In progress |
| 7 | Private-beta hardening, analytics, and deployment | Planned |

## Completed features

### Phase 6.1 — Play history and completed Mission Walls

- **Status:** Complete; merged through PR #12 into `main` (`8b4c320`).
- **Completed:** 8 October 2026.
- **Started:** 8 October 2026.
- **Scope:** Active-profile-owned history, saved Mission Walls, frozen replacement details, and replay through the existing start flow.
- **Key routes:** `/play-history`, `GET /api/v1/play-sessions/history`, `GET /api/v1/play-sessions/history/:sessionId`.
- **Delivered:** Bounded newest-first history and saved-detail APIs, completed/ended labels, saved Mission Walls and replacement summaries, empty/loading/retry states, and replay using current published content. The screen discards pending responses on unmount or account changes.
- **Approved addition:** Recommendations prefer unplayed paths within each match group, preserve exact-before-fallback ordering, and label repeats “Played before.” Only completed sessions owned by the parent and active child influence this preference; repeat activities remain available.
- **Validation:** TypeScript checking and ten focused Play Session tests passed on 8 October 2026, including history ownership, equal-time pagination, invalid queries, frozen replacement snapshots, replay preservation, and unavailable catalogue content.
- **Final verification:** `npm run verify` passed on the uncommitted Phase 6.1 application working tree based on `6a5b4d8`, on 8 October 2026: TypeScript, 12 catalogue paths, 13 profile options, 54 tests, production build, and progress guard. Earlier focused results were ten Play Session tests and eleven recommendation tests. After that full pass, only saved-wall pending-element wording changed; the post-fix TypeScript/production build and browser check passed separately.
- **Developer UI checks:** Synthetic-data browser checks covered list/detail, completed and partial walls, saved replacement labels, pagination, empty history, failed-load retry, unavailable replay, replay opening Mission 1 with fresh progress, and the “Played before” discovery label. Checked desktop, 390px mobile and 768px tablet layouts, plus keyboard activation. Existing shared cards/wall styling was reused; the Stitch project has no dedicated history screen, so exact history-design comparison is not evidenced.
- **Bounded review fix:** New-session creation (including history replay) checks the current published catalogue's age band against the active child's current age using the same calculation as recommendations. Ineligible paths return safe not-found without creating a session or altering history; existing active-session resumption remains unchanged. Eleven focused Play Session tests passed after this fix, including rejected age-ineligible replay and successful age-eligible replay. The earlier full gate remains prior evidence, not a fresh pass on this fix.
- **Review/testing sign-off:** User supplied the replay age-eligibility review finding; it was fixed and validated with focused checks. The user subsequently reported testing passed and approved delivery. No independent reviewers/testers were launched by the Developer; detailed live-database and cross-account browser results were not supplied separately.
- **Follow-up:** Run `npm run setup:play-sessions` in deployment environments to add the repeatable history index; no content reseed or document migration is required for history.
- **Production follow-up (8 October):** Screenshot shows history `400`, not `404`. The Vercel adapter now removes the runtime's own query property so internal rewrite fields cannot shadow Express's public-URL query parser. A synthetic Vercel-shaped regression checks public and forwarded URLs, valid pages, invalid limits, and unknown-field rejection. Twelve focused Play Session tests and TypeScript passed. Fix remains uncommitted on the Phase 6.2 branch; production redeployment and confirmation remain pending.

## Planned next feature

### Bounded production follow-up — favourites/history query validation

- **Status:** Local fix complete on `feature/vercel-query-validation`, 9 October 2026; user approved commit. Production confirmation remains pending.
- **Finding:** Deployed favourites screenshot still shows `400` for `?limit=10` after PR #13. The earlier adapter cleanup does not protect routes if a hosting runtime query property is reintroduced; the actual rejected production field has not been observed.
- **Fix:** Favourites/history pagination now reads the restored public URL directly instead of runtime `request.query`. Strict Zod validation retains rejection of unknown fields, invalid bounds and repeated pagination fields.
- **Validation:** Both synthetic rewrite-query regressions reproduced `400` before the fix; all 18 favourites/Play Session tests passed afterward. TypeScript passed. Existing full-gate evidence predates this bounded fix; no full lifecycle rerun.
- **Remaining:** Push/PR/deployment and confirmation against the deployed authenticated favourites/history routes. User authorized the fix commit; no production database changes made.

### Phase 6 delivery sequence

- **Status:** Phase 6.1 complete and merged; Phase 6.2 complete on its feature branch; Phase 6.3 planned.
- **Completed:** 9 October 2026. User reported review done and authorized the Phase 6.2 commit; detailed reviewer/tester results were not supplied in this chat.
- **Branch:** `feature/play-path-favourites`, based on latest `main` (`8b4c320`).
- **Scope:** Parent-owned saved Play Paths, save/remove controls on recommendations and authenticated details, and a paginated Favourites page. Individual mission favourites and recommendation weighting are deferred.
- **Dependencies:** Phase 6.1 is merged. Reuse authenticated ownership, current catalogue details, and the age-eligible session-start flow.
- **Storage:** Approved `favoritePlayPaths` collection; `npm run setup:favourites` installs its validator and indexes. Save operations establish the unique owner/path index before upserts. No catalogue reseed required.
- **Delivered so far:** Save/remove controls on recommendation cards and authenticated details; `/favourites` lists current published cards with bounded pagination and removable unavailable bookmarks. Duplicate actions are blocked and pending UI results are invalidated on unmount/account changes. Existing history and session-start eligibility remain unchanged.
- **Validation:** TypeScript and production build passed; four focused favourites API tests and eleven existing Play Session tests passed on 8 October 2026. Coverage includes parent isolation, repeated save/remove, validation, paging, verification/beta policy, withdrawn content, safe storage errors, and existing age-eligible replay rules. Loopback test requests required sandbox escalation; the supported rerun passed all 15 tests. Synthetic browser smoke covered saving from recommendations, saved button state, Favourites listing, opening/back from saved details, removal, and empty state.
- **Finalization (8 October 2026):** `npm run verify` passed on the Phase 6.2 application working tree based on `8b4c320`, including the Vercel history fix and navigation refinement: TypeScript, 12 Play Paths, 13 profile options, 61 automated tests, production build, and progress guard. Only finalization documentation changed afterward. Developer verification is complete; no independent review/testing was launched.
- **Remaining:** Vercel redeployment/history confirmation and target-database setup with `npm run setup:favourites`. Live MongoDB persistence/account-switch manual evidence remains unrecorded here. Commit authorized; push and merge are not part of this request.
- **Bundled follow-up:** Include the Phase 6.1 Vercel history-query adapter fix in the eventual single Phase 6.2 commit, as requested. Saved detail views use “Saved Play Path”; concurrent first saves recover a unique-index race only after confirming the same parent's bookmark.
- **Latest focused checks:** Five favourites tests passed after concurrent-save recovery, including a mocked MongoDB unique-index race and rejection when the matching bookmark is absent. Twelve Play Session tests cover the Vercel adapter and existing session behavior; these are included in the final full gate.
- **Approved design refinement:** Applied refined Stitch favourites empty/populated layouts, inline bookmark/heart illustration, Explore CTA, uncropped activity imagery, and parent-owned wording. Shared signed-in navigation replaces the flat header actions on dashboard, favourites, history, profile and password pages; mobile uses a bottom navigation bar and desktop uses primary pills. Account disclosure retains profile/password/sign-out, supports keyboard Escape/focus return and outside dismissal, and preserves account visibility after sign-out failure. Removed the redundant history header. Guests and active-mission screens retain their existing navigation.
- **Design validation:** Prior Developer synthetic-browser checks compared the refined Stitch layout at desktop, 390px mobile and 768px tablet: empty/populated favourites, recommendation save, removal returning to empty state, Explore/history navigation, password-page navigation, account disclosure, Escape returning focus to the trigger, and simulated sign-out failure retaining the session/error. Final history check confirmed the duplicate header is removed. This browser evidence was reused at finalization; it does not establish live database persistence or cross-account browser behavior. Screenshots are local untracked artifacts.
- **Acceptance criteria:** Recorded in `docs/implementation-plan.md`. Favourites and fixed-choice feedback follow as Phases 6.2 and 6.3; Routine Paths remain a later extension.

## Earlier completed features

### Mission skip and curated replacement

- **Status:** Complete
- **Branch:** `feature/mission-skip-replacement`
- **Started:** 6 October 2026
- **Completed:** 7 October 2026
- **Scope:** Fixed-choice skip reasons, catalogue-curated mission substitutes, retry-safe session persistence, resume behavior, and stable Mission Wall progress for authenticated active Play Sessions.
- **Decision:** Catalogue entries explicitly pair reviewed fallback Play Paths; the server never assembles an arbitrary replacement from unrelated content.
- **Review fix:** Late skip responses are discarded when the authenticated account, active Play Session, current mission, or active-play action changes while the request is in flight.
- **Delivered:** Fixed-choice skip reasons, published curated replacements, frozen replacement records, retry-safe swaps, restored replacements, and stable original Mission Wall positions. Guest activities retain their existing behavior.
- **Key files or routes:** `server/playSessions.ts`, `server/catalog.ts`, `server/seedCatalog.ts`, `src/App.tsx`, `POST /api/v1/play-sessions/:sessionId/missions/:missionId/skip`.
- **Validation:** `npm run verify` passed on the final Phase 5.2 application working tree on 7 October 2026: TypeScript, 12 Play Paths, 13 profile options, 50 automated tests, production build, and progress guard. The user confirmed code review and manual testing passed. Earlier focused coverage included eight Play Session tests; post-review TypeScript checking passed. Only completion documentation changed after the full gate.
- **Delivery:** PR #11 merged into `main`; local `main` updated on 8 October 2026. No remaining Phase 5.2 implementation work.

### Persistent active Play Sessions

- **Status:** Complete
- **Branch:** `feature/active-play-sessions`
- **Completed:** 6 October 2026
- **Scope:** Parent-owned session start and resume, ordered mission completion, durable Mission Wall progress, pause, completion, and explicit abandonment for authenticated Play Paths.
- **Delivered:** One active MongoDB-backed session per child profile; frozen Play Path and mission snapshots; secure parent and active-profile ownership; refresh and cross-browser resumption; sequential, retry-safe mission completion; persistent Mission Wall reveals; completed and abandoned lifecycle states; account-switch state isolation; and unchanged browser-only guest progress.
- **Key files or routes:** `server/playSessions.ts`, `src/App.tsx`, `src/api.ts`, `POST /api/v1/play-sessions`, `GET /api/v1/play-sessions/active`, `POST /api/v1/play-sessions/:sessionId/missions/:missionId/complete`, `POST /api/v1/play-sessions/:sessionId/abandon`
- **Validation:** `npm run verify` passed with TypeScript checks, 12 Play Paths and 13 profile options validated, 46 automated tests, the production build, and the progress guard. Focused session coverage verifies start, resume, ordered and repeated completion, final completion, single-active-session enforcement, abandonment, authentication, and safe errors. The repeatable play-session storage setup completed against `play_spark_dev`.
- **Follow-up:** Merged through PR #10; Phase 5.2 adds fixed-choice mission skipping and curated replacement.
- **Feature-log note:** Code-review fixes isolate active-session loading by authenticated account, resume the same Play Path after a concurrent duplicate start, and enforce the current child profile in the atomic abandonment operation. Post-review TypeScript checking and six focused session tests pass.

### Personalized discovery and rule-based recommendations

- **Status:** Complete
- **Branch:** `feature/personalized-recommendations`
- **Completed:** 5 October 2026
- **Scope:** Authenticated recommendations combining the active child profile with available time, current energy, practical constraints, optional interest, and published Play Path eligibility, presented through a responsive parent discovery dashboard.
- **Delivered:** Deterministic age-suitable ranking with exact matches ahead of fallbacks; named relaxed-preference explanations; safe authenticated and profile-owned API boundaries; automatic filter refresh with loading, retry, and no-result states; authenticated Play Path details with parent-facing labels; two explicitly enabled public guest samples; and 12 purpose-led seeded Play Paths with action-first missions, repository-owned artwork for the additions, and distinct Mission Wall reveals.
- **Key files or routes:** `server/recommendations.ts`, `src/DiscoveryDashboard.tsx`, `content/guest-samples.json`, `POST /api/v1/recommendations`, `GET /api/v1/play-paths/:playPathId`
- **Validation:** Manual Phase 4 testing covered signed-in discovery, time and preference changes, authenticated detail loading, Mission Wall progression, guest boundaries, and responsive interaction. Its authenticated guest-label finding was fixed. Code review findings for exact-match ordering, constraint explanations, and guest catalogue exposure were fixed with focused regression coverage. `npm run verify` passes with TypeScript checks, 12 Play Paths and 13 profile options validated, 42 automated tests, the production build, and the progress guard. The repeatable development seed completed with exactly two guest-enabled samples.
- **Follow-up:** Signed-in session persistence, mission actions, durable Mission Wall progress, favourites, history, and feedback remain Phases 5 and 6. Routine Paths remain a post-MVP extension.

### Child-profile editing and private-beta access

- **Status:** Complete
- **Branch:** `feature/child-profile-editing`
- **Completed:** 1 October 2026
- **Scope:** Let parents review and update their existing child profile, and allow controlled private-beta account access while production email delivery is unavailable.
- **Delivered:** A parent-owned partial profile-update API; an authenticated review/edit screen with retry, cancel, validation, nickname removal, and save-success states; and an explicit server-side beta policy that skips verification delivery and stores new beta accounts as verification-exempt while preserving the production verification flow for later activation.
- **Key files or routes:** `src/ChildProfilePage.tsx`, `server/childProfile.ts`, `server/auth.ts`, `PATCH /api/v1/child-profile`, `/child-profile`, `REQUIRE_EMAIL_VERIFICATION`
- **Validation:** `npm run verify` passes with TypeScript and content validation, 33 automated tests, the production build, and the progress documentation guard. Focused coverage includes production verification behavior, beta sign-up without email delivery, beta child-profile access, partial updates, ownership, validation, and safe failure handling.
- **Follow-up:** Configure `REQUIRE_EMAIL_VERIFICATION=false` in private-beta environments. Before public launch, verify a production sending domain, switch the setting to `true`, and smoke-test verification and password-reset delivery.

### Child onboarding

- **Status:** Complete
- **Branch:** `feature/child-onboarding`
- **Completed:** 29 September 2026
- **Scope:** One verified-parent-owned beta child profile with optional nickname, birth month/year, MongoDB-backed curated interests and play styles, secure profile APIs, and responsive onboarding.
- **Delivered:** Repeatable profile-option seeding, secure verified-parent profile APIs, one-active-profile enforcement, session refresh, and a responsive four-step onboarding flow. The catalogue contains six purpose-led Play Paths; public and guest routes expose two samples, while verified parents with a completed profile can browse all six from the main route. The same-origin Vercel adapter serves the frontend and Express API together.
- **Key files or routes:** `src/OnboardingPage.tsx`, `server/childProfile.ts`, `content/profile-options.json`, `GET /api/v1/profile-options`, `POST /api/v1/child-profile`, `GET /api/v1/child-profile`
- **Validation:** `npm run verify` passed with TypeScript and content validation, 29 automated tests, the production build, and the progress guard. GitHub and Vercel checks passed on PRs #6 and #7; profile options and six Play Paths were seeded and checked through the live development API. Production smoke testing confirmed healthy frontend routes, API and database connectivity, two public landing samples, two guest-preview samples, the signed-out account invitation, a working sign-in entry, and protected unauthenticated onboarding.
- **Follow-up:** Child-profile editing remains Phase 3.2. Rule-based recommendations remain Phase 4.

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
  - Schema-validated, repeatable seed content for six reviewed guest samples.
  - Essential MongoDB collection validators and catalogue indexes.
  - Database-owned Mission Wall labels and reveal messages while completion progress remains browser-only.
  - One-time migration of browser progress from the former readable sample and mission identifiers to catalogue ObjectIds.
  - Conflict-free reseeding when existing guest samples exchange display positions.
  - Safe not-found and catalogue-unavailable API responses.
- **Key files or routes:** `content/guest-samples.json`, `server/seedCatalog.ts`, `server/catalog.ts`, `GET /api/v1/guest/samples`, `GET /api/v1/guest/samples/:sampleId`
- **Validation:** `npm run verify` passed for the original catalogue delivery. The seed completed repeatedly against `play_spark_dev`; each sample returns three ordered missions.
- **Feature-log note:** Phase 3.1 expands the reviewed sample catalogue from two to six Play Paths with repository-owned artwork, distinct Mission Wall scenes for the four additions, and clear parent-facing goals and supported skills for every path.
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
