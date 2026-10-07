# 0009 — Use curated catalogue links for mission replacements

- **Status:** Accepted
- **Date:** 6 October 2026

## Context

A parent may need to change the current mission because materials are unavailable, the activity is too messy or noisy, it needs too much help, or the child is not interested. Automatically combining arbitrary missions can break the Play Path’s age suitability, practical constraints, and narrative.

## Decision

Each seeded Play Path explicitly identifies one reviewed fallback Play Path with the same mission count. When the parent skips the current mission, the server uses the published fallback mission at the same position. The active session retains its frozen original Play Path and stores a separate record containing the original mission identifier, fixed reason, replacement mission snapshot, and timestamp.

Completion continues to use the original mission position and Mission Wall element. Repeated or concurrent skip requests return the already recorded replacement.

## Consequences

- Content review determines replacement quality; the server does not infer or randomly select alternatives.
- Retiring a fallback mission prevents new swaps but does not invalidate replacements already frozen in active sessions.
- Catalogue validation requires every seeded fallback pair to contain the same number of missions.
- Phase 6 can use the preserved reason and original/replacement snapshots for history and feedback.
