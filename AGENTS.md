# Play Spark — Agent Instructions

## Product and architecture

- Read the approved project documents, `docs/implementation-plan.md`, and `docs/progress-status.md` before implementing a feature.
- Keep the approved stack: React + TypeScript frontend, Node.js + Express backend, MongoDB Atlas accessed only from the backend, and Zod request validation.
- Preserve the single same-origin service: Express serves the built frontend and `/api/v1` endpoints.
- Do not introduce Cloudflare Workers, a separate backend deployment, or unapproved libraries/architecture without discussing it first.

## Branching and commits

- `main` is the stable default branch. Never implement a feature directly on `main`.
- Create one branch for each independently reviewable feature, named `feature/<short-feature-name>`.
- Start each feature branch from the latest `main` branch.
- Keep a feature branch limited to its agreed scope; do not include unrelated refactors or incomplete work.
- Run relevant checks and tests before committing.
- Run `npm run verify` before completing a feature.
- Use clear Conventional Commit-style messages, such as `feat(auth): add parent account access`.
- Push the feature branch for review. Merge it into `main` only after user approval.

## Security and data

- Never commit secrets, credentials, `.env` files, tokens, or database connection strings.
- Keep authentication server-side with secure cookie-based sessions as defined in the architecture documentation.
- Validate external input with Zod and return safe API errors.
- Do not inspect, display, or log secret values from local environment files.

## Collaboration and changes

- Discuss material product, UX, architecture, data-model, or dependency changes before making them.
- Do not modify unrelated user changes in a dirty worktree.
- Use `apply_patch` for source and documentation edits.
- Prefer small, maintainable, expandable changes over premature complexity.
- Follow `docs/definition-of-done.md` for every feature.
- Record material architecture, dependency, data-model, security, or deployment decisions in `docs/decisions/`.

## Progress tracking

- Read `docs/progress-status.md` before planning or implementing a feature so completed work is not repeated and current dependencies are understood.
- Mark a feature `In progress` when implementation begins on its feature branch.
- Update `docs/progress-status.md` as part of every completed feature, before the feature commit.
- Record the feature name, status, branch, completion date, delivered behavior, important files or API routes, validation performed, and any remaining follow-up work.
- Mark a feature `Complete` only after its agreed scope is implemented and the relevant checks pass. Use `In progress`, `Planned`, or `Blocked` accurately for unfinished work.
- Keep entries concise and factual. Do not record secrets, credentials, environment values, or speculative work as completed.
- If a feature changes an earlier entry, update that entry and add a short note to the feature log so the file reflects the current product rather than stale history.

For the fuller workflow reference, see `docs/development-workflow.md`. For planned work and acceptance criteria, see `docs/implementation-plan.md`. For the current implementation state, see `docs/progress-status.md`.
