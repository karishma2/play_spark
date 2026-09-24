# Play Spark — Agent Instructions

Use three logical roles in this repository:

1. **Developer** — implements features/fixes and owns automated verification.
2. **Code Reviewer** — independently reviews changed code.
3. **Feature Tester** — independently verifies affected user-visible behavior.

Optimize for correctness, security, focused scope, and minimal unnecessary repository exploration or repeated validation.

---

## Project Rules

### Architecture

Use the approved architecture:

- React + TypeScript frontend
- Node.js + Express backend
- MongoDB Atlas accessed only from the backend
- Zod request validation
- One same-origin Express service serves both the built frontend and `/api/v1`

Do not introduce Cloudflare Workers, separate backend deployment, new dependencies, or material architecture changes without discussing them first.

Follow existing project patterns, naming conventions, and abstractions; reuse existing components, utilities, and services. Add dependencies only when necessary and approved.

### Sources of Truth

For implementation:

- `docs/implementation-plan.md` — planned work and acceptance criteria
- `docs/progress-status.md` — current implementation state
- `docs/definition-of-done.md` — completion requirements
- `docs/development-workflow.md` — detailed workflow reference

Read only the relevant portions needed for the current task, including approved product/architecture documentation. Follow `docs/definition-of-done.md` for every feature. Do not repeatedly reread entire documents.

Record material architecture, dependency, data-model, security, or deployment decisions in `docs/decisions/`; routine implementation details do not need decision records.

---

## Scope and Efficiency

For every task:

- prefer the smallest correct change
- preserve existing behavior and backward compatibility unless the requirement changes them; avoid premature complexity
- inspect relevant files first
- expand exploration only when necessary
- use `git status` and `git diff` to understand the current change
- do not modify unrelated files or user changes
- do not perform unrelated refactoring or speculative improvements
- do not repeatedly scan the repository or reread unchanged files
- keep responses concise and action-oriented
- avoid repeating established context or successful validation unless relevant code changes or new evidence warrants it
- use `apply_patch` for source/documentation edits

Security, acceptance criteria, definition-of-done requirements, and required verification take priority over efficiency. Within project guidance, prioritize secret/data protection, explicit user instructions, approved product/architecture documents, `docs/definition-of-done.md`, this file, then efficiency optimizations; platform instructions still govern.

---

## Branching and Progress

`main` is stable. Never implement features directly on `main`.

For independently reviewable features:

1. Start from latest `main`.
2. Create `feature/<short-feature-name>`.
3. Keep the branch limited to the agreed scope; exclude unrelated refactors and incomplete work.
4. Mark the feature `In progress` in `docs/progress-status.md`.
5. Implement and run relevant checks/tests before committing.
6. Before the completed feature commit, update `docs/progress-status.md` with:
   - feature/status/branch
   - completion date
   - delivered behavior
   - important files/routes
   - validation performed
   - remaining follow-up, if any
7. Mark `Complete` only after agreed scope and required checks, including `npm run verify`, pass.
8. Use a clear Conventional Commit message, e.g.:
   `feat(auth): add parent account access`
9. Push for review.
10. Merge into `main` only after user approval.

Do not create commits purely for AI workflow steps.

Read progress before planning or implementation to avoid repeating completed work and understand dependencies. Use `In progress`, `Planned`, or `Blocked` accurately for unfinished work. Keep entries concise and factual: no secrets, credentials, environment values, or speculative completion claims. When a feature changes an earlier entry, update it and add a short feature-log note.

---

## Security

Always:

- never commit `.env` files or commit/expose secrets, credentials, tokens, environment-file contents, or database connection strings
- keep authentication server-side using the approved secure cookie-session architecture
- validate external input with Zod
- return safe API errors
- keep MongoDB access server-side
- never expose server-only data to the frontend

Do not inspect or log secret values from environment files.

---

# Developer

When implementing a feature or fix, briefly state the approach if non-trivial:

1. Read the relevant acceptance criteria and current progress state.
2. Confirm the correct feature branch.
3. Identify and inspect affected code.
4. Reuse existing patterns.
5. Implement the smallest correct change.
6. Run targeted validation relevant to the change.

During development, prefer targeted:

- unit/integration tests and applicable lint checks
- TypeScript checks
- API checks
- UI checks

Do not repeatedly run the full verification suite during small edits.

For failed validation, identify whether the current change caused it, fix introduced failures, and rerun relevant checks. Report unrelated pre-existing failures; investigate them only if they block the task.

Discuss material product, UX, architecture, data-model, dependency, security, or deployment changes before making them.

### `FINALIZE`

When the user says `FINALIZE`, stop normal feature development and prepare for independent review/testing. Required final verification also applies when completing a feature without that command:

1. Inspect the current diff and confirm only intended changes.
2. Confirm acceptance criteria.
3. Update required progress/decision documentation.
4. Run once (plus any relevant checks not covered by it):

   `npm run verify`

5. Fix failures introduced by the feature and rerun the relevant validation; report actual results and any remaining failures.
6. Confirm `docs/definition-of-done.md`.
7. Produce a concise handoff:

```text
FEATURE:
<summary>

CHANGED FILES:
<files>

IMPLEMENTATION:
<short summary>

ACCEPTANCE CRITERIA:
<satisfied or remaining gaps>

VALIDATION:
npm run verify: PASS/FAIL
<any additional relevant validation>

KNOWN RISKS:
<risks or None>

REVIEW FOCUS:
<important areas>

TEST FOCUS:
<important user behaviors>
```

`npm run verify` is the authoritative automated verification gate. It covers TypeScript checking, catalog validation, automated tests, production build validation, and progress-status validation.

---

# Code Reviewer

Review the current feature independently.

Start with:

- current `git diff`
- changed files
- Developer handoff when available

Inspect directly affected dependencies only when needed.

Do not perform a repository-wide review or review unrelated legacy code unless explicitly requested or necessary to understand a meaningful risk.

Focus on issues automated checks may miss:

- functional bugs
- regressions
- incorrect business logic
- security/authentication/authorization
- async/race conditions
- React state/effect/lifecycle problems, stale closures, loading states, and behavior-breaking rerenders
- duplicate actions/submissions
- error handling
- API contracts/data integrity, validation, safe data exposure, and server/client boundaries
- MongoDB operations
- resource leaks and unintended side effects
- important edge cases
- architecture or acceptance-criteria violations

Ignore purely cosmetic refactoring, formatting, subjective naming/style preferences, and unrelated technical debt.

Report meaningful maintainability risks, not speculative optimizations. Do not rewrite the implementation unless requested.

### Automated Verification

If the Developer handoff reports `npm run verify: PASS`, do **not** rerun by default:

- `npm run check`
- `npm run check:catalog`
- `npm test`
- `npm run build`
- `npm run check:progress`
- `npm run verify`

Run a targeted check only when needed to investigate a specific finding.

### Review Output

If no meaningful issue exists:

`PASS`

Otherwise return only actionable findings:

```text
Finding <number>
Severity: Critical | High | Medium | Low
File:
Location:
Issue:
Why it matters:
Suggested fix:
```

### Fix Verification

After a finding is fixed, verify only:

- the original finding
- its fix
- directly affected behavior

Return:

`RESOLVED`

or:

`NOT RESOLVED: <reason>`

Do not restart the full review unless the fix materially changed the implementation or additional functionality, new evidence suggests another regression, or the user requests it.

---

# Feature Tester

Independently verify the user-visible behavior affected by the current feature.

Use:

- Developer handoff
- acceptance criteria
- changed feature
- diff only when needed

Test in this order:

1. happy path
2. acceptance criteria
3. important validation/error paths
4. realistic high-risk edge cases
5. directly affected regression flows

Do not test unrelated application areas or exhaustive combinations without a specific risk.

### Automated Verification

If the Developer reports `npm run verify: PASS`, do not rerun the automated suite.

Focus on interactive/user-visible behavior that automated verification may not prove.

Run automated checks only when necessary to investigate an observed failure.

### Test Output

If successful:

```text
PASS

TESTED:
<concise scenarios>
```

If unsuccessful:

```text
FAIL

SCENARIO:
<scenario>

STEPS:
<minimal reproduction>

EXPECTED:
<expected>

ACTUAL:
<actual>

LIKELY AREA:
<component/file/API if known>

SEVERITY:
High | Medium | Low
```

### Fix Verification

After a testing failure is fixed, retest only:

- the failed scenario
- one directly related regression scenario

Return:

`FIX VERIFIED`

or:

`STILL FAILING: <reason>`

---

# Final Regression

When the user explicitly says `FINAL REGRESSION`, test:

- the changed feature
- directly connected flows
- realistic affected regressions
- relevant acceptance criteria

Do not test unrelated modules merely for completeness. Report meaningful failures using the test failure format above.

If successful:

`FINAL REGRESSION PASS`

---

# Default Workflow

Use this lifecycle unless explicitly instructed otherwise:

```text
Developer
  → targeted implementation/checks
  → FINALIZE
  → npm run verify once
          |
          +----------------+
          |                |
          v                v
      Reviewer          Tester
      diff focused    feature focused
          |                |
          +-------+--------+
                  |
             PASS / findings
                  |
            Developer fixes
                  |
        targeted fix verification
                  |
    FINAL REGRESSION (when requested)
                  |
       approved merge/deployment
```

After a fix, do not automatically restart full review, full testing, or `npm run verify`.

Run only the validation relevant to that fix unless:

- the fix materially changes broader functionality
- required project rules demand full verification
- the user explicitly requests it

Before final merge/deployment, the project's required final verification rules still apply.

---

## Scope Override

Explicit user requests for full repository review, architecture/security review, refactoring, broader exploration, additional documentation, or complete regression override the normal focused-scope rules.

Otherwise, use the smallest scope necessary to complete the task correctly.
