# Play Spark — Agent Instructions

## Default: one owner, bounded work

- Act as Developer unless the user assigns another role. Roles are responsibilities, not an instruction to launch agents.
- Do not spawn subagents or start independent review/testing unless the user explicitly requests delegation or those independent checks. `FINALIZE` alone does not request them.
- Use either the assigned review/testing tasks OR delegated agents for the same scope, never both. Reuse their recorded findings and results.
- Keep the assigned role. Reviewer and Tester are read-only unless the user explicitly asks them to edit. In those roles, `FINALIZE` means summarize that role's findings and gaps; do not take over Developer verification or update progress.
- Treat supplied review comments as a bounded fix task, not a new feature or a request to repeat the lifecycle.
- Stop when the requested scope and relevant validation are complete. Do not invent another review, test, cleanup, or documentation phase.

## Project constraints

- Preserve React + TypeScript, Node.js + Express, backend-only MongoDB Atlas, and Zod input validation.
- Keep one same-origin Express service serving the built frontend and `/api/v1`. No Cloudflare Workers or separate backend deployment without prior discussion.
- Reuse established components, utilities, naming, and abstractions. Preserve existing behavior and backward compatibility unless requirements change them; avoid speculative refactors and premature complexity.
- Discuss material product, UX, architecture, data-model, dependency, security, or deployment changes first. Add dependencies only when necessary and approved.
- Never inspect, display, log, or commit secrets, credentials, tokens, environment values, database connection strings, or private user data. Never commit `.env` files.
- Keep secure cookie-session authentication and MongoDB access server-side. Validate external input with Zod, enforce ownership checks, return safe API errors, and do not expose server-only data.
- Follow approved privacy and analytics constraints and applicable `docs/definition-of-done.md` requirements. Efficiency never overrides security, acceptance criteria, or required final verification.
- Respect platform instructions and explicit user scope. Approved product/architecture documents and the definition of done govern project requirements; this file defines focused role execution.

## Read only what is needed

- Before feature planning/implementation, read the relevant entry in `docs/progress-status.md` and acceptance criteria in `docs/implementation-plan.md`; check completed work and dependencies.
- Consult relevant approved architecture/design documents and `docs/development-workflow.md` only as needed. Its feature lifecycle applies to new/completed features, not every review-comment fix.
- Read applicable repository instructions, then use `git status` and a scoped diff. Inspect named files/functions first; expand only for a concrete dependency or risk.
- Do not repeatedly read whole files, all docs, full logs, or unchanged diffs. Use targeted searches and bounded output; inspect full failure output only when needed.
- Reuse established context and validation evidence. Do not recreate information already in a handoff or progress entry.
- Use `apply_patch` for edits. Preserve unrelated user changes; do not modify unrelated files.

## Branching, progress, and delivery

- Never implement product features on `main`. Start each independently reviewable feature from latest `main` on `feature/<short-feature-name>`; fixes stay on the existing feature branch.
- Keep agreed scope separate from unrelated refactors or incomplete work. Run relevant checks before committing.
- Mark a feature `In progress` when implementation begins. Before the completed feature commit, update progress with feature/status/branch, completion date, delivered behavior, important paths/routes, validation, and remaining work.
- Mark `Complete` only when agreed scope and required checks pass. Use `Planned`, `In progress`, or `Blocked` accurately; never report speculation as completed.
- Keep progress concise and factual. Update stale entries and add one short feature-log note when delivered behavior changes. Batch related fixes into one accurate update; no per-agent status rewrites.
- Record material architecture, dependency, data-model, security, or deployment decisions in `docs/decisions/`; no decision records for routine fixes.
- Use Conventional Commits and the existing PR template. Push for review when requested/in scope; merge only after user approval.
- Do not create workflow-only commits, amend published commits, or rewrite branch history merely to tidy AI work. Use ordinary follow-up commits unless the user requests history changes.
- For commit/push/PR-only requests, reuse valid validation evidence; do not restart implementation, review, or testing.

## Review-comment fixes: shortest path

1. Read the supplied findings, affected code, and fix diff. Reproduce only if necessary to establish the defect.
2. Implement the smallest correct fixes together; do not expand to unrelated findings.
3. Run the smallest meaningful validation covering the fixes. Add/update a regression test when it proves an important failure mode; avoid tests that only mirror implementation.
4. Update the existing progress entry once if delivered behavior/validation changed or the progress guard requires it.
5. Report each finding as fixed/unresolved, checks actually run, and remaining gaps; then stop.

Do not automatically run `FINALIZE`, full review, full browser testing, or `npm run verify` for this path. Expand validation only for a concrete broader impact, explicit request, or required final gate; state why. Report unrelated pre-existing failures and investigate only if they block the task.

## Verification ownership

- Developer owns automated verification. During development use relevant unit/integration tests, TypeScript/lint checks, API checks, or UI checks.
- `npm run verify` is the feature-completion gate: TypeScript, catalog validation, automated tests, production build, and progress validation. Run it at feature finalization, not after every edit.
- An existing passing result can be reused for the same relevant code/configuration. Record the checked commit or working-tree state and any later edits; never present an earlier full pass as a fresh pass on changed code.
- After fixes, run affected checks and report them separately from the earlier full pass. Rerun the full gate for material broader changes, required merge/deployment rules, or explicit requests.
- Reviewer/Tester do not run the full gate or its component checks by default, even if a handoff is missing. Report missing verification evidence; use a targeted check only to investigate a specific finding/failure.
- No application suite for documentation-only edits; check the diff and any applicable documentation guard.
- Do not repeat passed checks without changed relevant inputs, new failure evidence, or a required gate. Required CI checks remain enabled.

## Developer: FINALIZE

When asked to `FINALIZE` or complete a feature:

1. Check the feature diff, acceptance criteria, applicable definition-of-done items, and required progress/decision documentation.
2. Run/reuse the full gate under the ownership rules above; perform applicable manual/design checks not already evidenced.
3. Fix introduced failures and validate affected behavior. Report blockers honestly; do not claim completion with unmet requirements.
4. Return one compact handoff and stop. Do not launch Reviewer/Tester automatically.

Handoff: feature + branch/state; changed files and behavior; acceptance criteria; checks/results (distinguish prior full gate from post-fix checks); risks/gaps; suggested review/test focus. Include independent results only if actually obtained. No lengthy transcript or repeated repository summary.

## Code Reviewer: only when requested

- Review the requested diff and directly affected dependencies. Use the handoff and relevant requirements; do not audit unrelated legacy code.
- **Start from the Developer handoff and feature diff. Do not independently rediscover repository architecture or reread files already sufficiently described by the handoff unless the diff, requirements, or a concrete risk requires deeper inspection.**
- Focus on defects, regressions, business logic, authentication/authorization, validation, API/data contracts, MongoDB operations, races, resource leaks, and meaningful maintainability risks.
- For React, include state/effect/lifecycle issues, stale closures, duplicate submissions, loading states, and behavior-breaking rerenders. Check safe data exposure and server/client boundaries.
- Ignore cosmetic preferences, speculative optimization, and unrelated debt. Do not rewrite code.
- Output `PASS` if no actionable findings; otherwise severity, file/location, issue, impact, and suggested fix.
- For re-review, check only original findings, their fixes, and direct effects. Return `RESOLVED` or `NOT RESOLVED: reason`. Expand only for concrete new regression evidence, material broader changes, or explicit request.

## Feature Tester: only when requested

- Independently test the affected user behavior: happy path, acceptance criteria, important validation/error paths, realistic edge cases, then directly affected regressions.
- **Start from the Developer handoff and acceptance criteria. Inspect implementation details only when needed to design a test, investigate a failure, or assess a directly affected regression.**
- Use existing test coverage/results to avoid repetition. Do not repeat all viewport sizes or account lifecycle flows for a fix that cannot affect them.
- Output `PASS` plus scenarios actually tested, or `FAIL` with scenario, minimal steps, expected/actual result, likely area, and severity. Disclose untested/blocked behavior.
- After a fix, retest the failed scenario and one directly related regression scenario. Return `FIX VERIFIED` or `STILL FAILING: reason`; do not restart full testing without broader impact.

## FINAL REGRESSION

Only when explicitly requested, cover the changed feature, connected flows, affected regressions, and relevant acceptance criteria. Reuse still-valid evidence; report meaningful failures or `FINAL REGRESSION PASS`. Do not test unrelated modules for completeness.

## Tool use and communication

- Prefer available authenticated connectors/CLIs for repository operations; use browser control when appropriate or necessary.
- After two equivalent tool/connection failures, diagnose once or use a supported alternative. Do not keep retrying without new evidence; report the blocker and complete unaffected work.
- Do not repeatedly poll tasks or servers; use bounded waits and reuse healthy existing dev services.
- Keep updates and final reports concise. A small fix needs a short result/checks/gaps report, not the full feature handoff.
- Broader user requests override focused scope. Explain actual gaps instead of silently skipping required checks.