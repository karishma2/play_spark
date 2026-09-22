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
| 2 — Parent accounts | Sign-up, sign-in, sign-out, password management, and secure server-side sessions | Phase 0 |
| 3 — Child onboarding | One active beta child profile with curated interests and play styles | Phase 2 |
| 4 — Discovery | Dashboard, filters, rule-based recommendations, and Play Path details | Phases 1 and 3 |
| 5 — Active play | Session start/resume, mission completion, skip, replacement, and completion | Phase 4 |
| 6 — Progress and retention | Mission Wall, favourites, history, and fixed-choice feedback | Phase 5 |
| 7 — Private-beta readiness | Account deletion, analytics, accessibility review, deployment, backup, and operational checks | Phases 2–6 |

## Phase 1 — Landing page and guest sample experience

**Proposed branch:** `feature/guest-experience`

**Stitch reference:** Project `Play Spark Activity Planner`; primary screen `Landing & Exploration` (`b5d36294b3a440e8a46839b3840fdb67`).

### Scope

- Establish shared design tokens and foundational UI components from the approved Stitch design system.
- Build the responsive landing and exploration experience.
- Provide two curated sample Play Paths with ordered missions.
- Implement `GET /api/v1/guest/samples` and `GET /api/v1/guest/samples/:sampleId`.
- Keep guest progress and sample-completion count in browser storage.
- Present an account invitation after two completed samples.

### Acceptance criteria

- A visitor understands the product purpose and can choose either sample without signing in.
- A visitor can read and complete every mission in a sample Play Path.
- Guest progress is never written to MongoDB.
- Refreshing the browser preserves the local two-sample count.
- Completing the second sample shows the account invitation.
- Invalid or unavailable sample identifiers return the documented safe API error.
- The experience works at relevant mobile and desktop sizes and meets the applicable Definition of Done.

## Later-phase preparation

Before each later phase begins, expand its scope into feature-level acceptance criteria and record any required dependency decision. Likely decisions include client routing, password hashing, browser testing, email delivery, analytics integration, and production session cleanup.
