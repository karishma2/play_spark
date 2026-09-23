# Play Spark — Development Progress

**Purpose:** This file is the durable record of what has been built, verified, and left for later. Read it with the approved architecture, database, ERD, API, and development-workflow documents before starting feature work.

**Last updated:** 23 September 2026

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
| 2 | Parent accounts and secure authentication | Planned |
| 3 | Child-profile onboarding and editing | Planned |
| 4 | Dashboard, filters, and rule-based recommendations | Planned |
| 5 | Active Play Sessions and mission actions | Planned |
| 6 | Mission Wall, favourites, history, and feedback | Planned |
| 7 | Private-beta hardening, analytics, and deployment | Planned |

## Completed features

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
