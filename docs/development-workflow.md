# Play Spark — Development Workflow

## Purpose

This workflow keeps each change reviewable, tested, documented, and recoverable when development resumes in a later session.

## Branching rule

`main` is the stable default branch. Do not implement product features directly on it.

Create one branch for each independently reviewable change:

```text
feature/<short-feature-name>
```

Start each branch from the latest `main`. Keep unrelated refactors and unfinished features out of the branch.

## Feature lifecycle

1. Read the approved architecture, ERD, database, API, implementation-plan, and progress documents.
2. Confirm the feature scope and acceptance criteria in `docs/implementation-plan.md`.
3. Create the feature branch from the latest `main`.
4. Add or update the feature entry in `docs/progress-status.md` and mark it `In progress`.
5. Implement a complete vertical slice: UI, API, validation, data or content, and meaningful tests as applicable.
6. Compare user-facing work with the approved Stitch reference at relevant viewport sizes.
7. Complete the checklist in `docs/definition-of-done.md`.
8. Run `npm run verify`.
9. Mark the feature `Complete` in `docs/progress-status.md`, recording delivered behavior, important paths, validation, and follow-up work.
10. Commit with a clear Conventional Commit message and push the feature branch for review.
11. Merge into `main` only after user approval.

## Verification

`npm run verify` runs the standard local quality gate:

```text
TypeScript checks → automated tests → production build → progress-file guard
```

GitHub Actions runs the same command on feature-branch pushes and pull requests. The progress guard fails when application work changes without a corresponding update to `docs/progress-status.md`.

## Pull requests

Use `.github/pull_request_template.md`. The pull request should describe the final behavior, relevant technical details, validation performed, and material limitations. Keep the description understandable to a reviewer who has not read the development conversation.

## Decisions

Create a short record in `docs/decisions/` when a change introduces or replaces a material architecture, dependency, data-model, security, or deployment choice. Small implementation details do not require decision records.

## Commit messages

Use concise Conventional Commit-style messages:

```text
feat(auth): add parent account access
feat(profile): add child profile setup
fix(auth): handle invalid session cookies
docs(api): clarify password reset flow
chore: update development dependencies
```

## Scope and security

- Do not modify unrelated user work.
- Do not commit secrets, `.env` files, credentials, database connection strings, or API keys.
- Discuss material product, UX, architecture, data-model, or dependency changes before implementing them.
- Keep the approved React, TypeScript, Express, MongoDB, Zod, and same-origin architecture unless a reviewed decision explicitly changes it.
