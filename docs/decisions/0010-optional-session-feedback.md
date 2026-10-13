# Optional completed-session feedback

Date: 9 October 2026

Status: Accepted

Phase 6.3 uses the approved separate `feedback` collection and unique `playSessionId` index. Parent ownership and active-child membership are checked against the completed session before reads or writes. Fixed choices may be changed by upserting the same record while preserving its original `createdAt`; session history timestamps are unchanged.

A nullable rating permits a reason-only response using the approved database enum. No free text, new dependency, analytics or recommendation weighting is introduced. Guests retain browser-only progress without feedback persistence. This follows the user's approved optional-feedback approach and keeps completion independent of submission.
