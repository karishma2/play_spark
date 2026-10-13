# Atomic parent account deletion

Date: 13 October 2026

Status: Accepted

Implement the previously approved immediate, irreversible deletion and exact-email confirmation contract. A MongoDB transaction deletes the authenticated parent and owned child profiles, Play Sessions, legacy mission snapshots, favourites, feedback, sessions and reset/verification tokens together. Curated catalogue data and other parents are retained. Transactions already exist in password-reset handling; no dependency or hosting change is required.

Deletion is available without email verification or a child profile. The UI clears authentication only after a successful response. Failed transactions return a safe retry message and retain the account. Backups are outside the live database deletion transaction; the Phase 7.4 backup/restore procedure must respect deletion requests before restoring old data.
