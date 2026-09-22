# Play Spark — Development Progress

**Purpose:** This file is the durable record of what has been built, verified, and left for later. Read it with the approved architecture, database, ERD, API, and development-workflow documents before starting feature work.

**Last updated:** 22 September 2026

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
| 1 | Landing page and guest sample experience | Planned |
| 2 | Parent accounts and secure authentication | Planned |
| 3 | Child-profile onboarding and editing | Planned |
| 4 | Dashboard, filters, and rule-based recommendations | Planned |
| 5 | Active Play Sessions and mission actions | Planned |
| 6 | Mission Wall, favourites, history, and feedback | Planned |
| 7 | Private-beta hardening, analytics, and deployment | Planned |

## Completed features

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
- **Delivered:** Workflow documentation, Definition of Done, phased implementation plan, decision-log templates, pull-request checklist, unified local verification, GitHub Actions verification, and an automated progress-file guard.
- **Key files:** `AGENTS.md`, `docs/`, `.github/`, `scripts/check-progress-update.mjs`, `package.json`
- **Validation:** `npm run verify` passes: TypeScript checks, 5 automated tests, production build, and progress-file guard.
- **Follow-up:** None.

## Planned next feature

### Landing page and guest sample experience

- **Status:** Planned
- **Proposed branch:** `feature/guest-experience`
- **Reference:** Stitch project `Play Spark Activity Planner`, especially the `Landing & Exploration` screen.
- **Intended outcome:** A visitor can understand Play Spark, open either of two curated sample Play Paths, complete the guest flow using browser-only progress, and receive the account invitation after the second sample.
- **Expected API:** `GET /api/v1/guest/samples` and `GET /api/v1/guest/samples/:sampleId`
- **Dependency:** Start from a clean, current `main` after the workflow documentation is committed.

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
