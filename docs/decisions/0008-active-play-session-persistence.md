# 0008 — Persist active Play Sessions as frozen parent-owned snapshots

- **Status:** Accepted
- **Date:** 5 October 2026

## Context

Signed-in parents need to pause and resume screen-free play across refreshes and devices. Catalogue content can be reseeded or revised while a family is partway through a Play Path, and concurrent mission-completion retries must not duplicate or reorder progress.

## Decision

Store one active Play Session per child profile in MongoDB. Each session is owned by the authenticated parent and contains a frozen Play Path snapshot, ordered mission snapshot, completed mission identifiers, lifecycle status, and timestamps. Mission completion is sequential and retry-safe. A session remains active until its final mission is completed or the parent explicitly abandons it.

Guest progress remains in browser storage. Phase 5.2 will add skip and replacement records without rewriting the original snapshot.

## Consequences

- Catalogue edits affect future sessions while an activity underway remains understandable and stable.
- A unique partial index enforces one active session per child profile.
- Session records duplicate a bounded amount of published content in exchange for reliable historical meaning.
- Phase 6 can build history and Mission Wall retention from completed session records.
