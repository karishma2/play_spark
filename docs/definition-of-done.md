# Play Spark — Definition of Done

A feature is complete only when every applicable item below is satisfied. If an item does not apply, note that in the feature entry or pull request rather than creating unnecessary work.

## Product and scope

- The agreed acceptance criteria are implemented.
- The branch contains only the agreed feature and necessary supporting changes.
- User-facing behavior matches the approved product documents and relevant Stitch reference.
- Loading, empty, error, and unavailable states are handled where the feature can encounter them.

## Frontend

- Layouts work at the relevant mobile, tablet, and desktop sizes.
- Shared tokens and components are reused instead of duplicating screen-specific styling.
- Interactive elements have semantic labels, visible focus states, keyboard access, and suitable touch targets.
- API access goes through the shared API layer rather than ad hoc component requests.

## Backend and data

- External input is validated with Zod before business logic or database access.
- Parent-owned data is authenticated and ownership-checked.
- API responses follow the documented `data` and `error` envelopes.
- Errors do not expose secrets, database messages, tokens, or stack traces.
- Database indexes, validators, content versions, or seed changes are repeatable and documented when applicable.

## Security and privacy

- No credentials, tokens, `.env` files, connection strings, or personal data are committed or logged.
- Analytics contain no email address, child nickname, birth data, free text, authentication data, or session recording.
- New dependencies or material security decisions have been discussed and recorded.

## Validation

- Meaningful tests cover business rules, state transitions, validation, ownership, or other important failure modes introduced by the feature.
- `npm run verify` passes.
- The primary user journey has been checked manually.
- User-facing screens have been compared with the approved Stitch design at relevant viewport sizes.

## Documentation and delivery

- `docs/progress-status.md` records the final delivered behavior and validation.
- `docs/implementation-plan.md` reflects any approved scope or sequencing change.
- A decision record exists for any material architecture, dependency, data-model, security, or deployment choice.
- The commit message follows the Conventional Commit style.
- The feature branch is pushed for review and is merged only after approval.
