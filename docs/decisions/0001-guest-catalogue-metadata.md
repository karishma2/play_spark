# 0001 — Store guest presentation metadata with Play Paths

**Status:** Accepted
**Date:** 23 September 2026

## Context

The approved catalogue model covers Play Paths, reusable missions, ordering, and Mission Wall scenes. The completed guest interface also needs developer-managed display fields such as the card image, safety note, category labels, setup time, and guest ordering. Keeping those values in server code would prevent MongoDB from being the catalogue source of truth.

## Decision

Add an optional `guestPreview` object to a Play Path. It contains whether the path is available to guests, its guest ordering, and the presentation metadata required by the existing guest cards and detail view. Missions and Mission Wall elements remain normalized in `missions`, `playPathMissions`, and `missionWallScenes`.

The public guest API continues to expose only the fields its UI requires. Guest progress remains browser-only.

## Consequences

- The two guest samples can be selected and ordered without hardcoded runtime identifiers.
- The same Play Path and mission records can later support signed-in discovery and active sessions.
- Guest-only presentation metadata does not need to be added to every general catalogue field.
- A future content-management interface must validate `guestPreview` when enabling a Play Path for guests.
