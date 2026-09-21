# Play Spark — API Design

**Version:** 1.2 — Private Beta  
**Status:** Agreed design baseline  
**Scope:** API contract and behaviour. Database structure is defined separately in the Database Design document.
**Last updated:** 21 September 2026

## 1. Purpose

The Play Spark API connects the React web application to the backend. It lets parents create an account, maintain one child profile in the beta, receive screen-free activity recommendations, run activity sessions, save favourites, and manage their account.

The API is designed to be simple for the beta and reusable by a future native mobile app.

### Runtime and deployment context

For the beta, one Node.js/Express service serves both the built React application and this API from a Render Web Service. The browser calls the same origin at `/api/v1`, so normal web use does not need CORS. The API contract stays runtime-independent, allowing a future native client or hosting change without route redesign.

## 2. API principles

- **Style:** REST API using JSON over HTTPS.
- **Base path:** `/api/v1`.
- **Authentication:** secure browser-session cookie; the browser never receives database credentials. The beta cookie is `Secure`, `HttpOnly`, and `SameSite=Lax` because the UI and API share one origin.
- **Ownership:** every parent-owned resource is checked against the signed-in parent before it is returned, changed, or deleted.
- **Validation:** shared Zod schemas validate every request before business logic or database access.
- **Privacy:** no child nickname, email address, or child-profile data is sent to product analytics.
- **Expandable design:** versioning and stable resource routes allow future native clients and additional child profiles without replacing the API.

## 3. Common conventions

### 3.1 Response format

Successful calls return a `data` object:

```json
{
  "data": {
    "title": "Car City Builders"
  }
}
```

Failed calls return a consistent `error` object:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fieldErrors": {
      "email": "Enter a valid email address."
    }
  }
}
```

### 3.2 Identifiers, dates, and pagination

- MongoDB identifiers are returned as strings, for example `"67bc..."`.
- Dates use ISO 8601 UTC timestamps.
- History endpoints use cursor pagination when needed: `?cursor=...&limit=20`.
- Request bodies use camelCase.

### 3.3 Common error codes

| HTTP status | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | One or more inputs are missing or invalid. |
| 401 | `UNAUTHENTICATED` | The parent needs to sign in. |
| 403 | `FORBIDDEN` | The parent does not own or cannot use this resource. |
| 404 | `NOT_FOUND` | The requested resource does not exist or is unavailable. |
| 409 | `CONFLICT` | The requested state change is not allowed. |
| 429 | `RATE_LIMITED` | Too many requests; try again later. |
| 500 | `INTERNAL_ERROR` | An unexpected server issue occurred. |

Error responses never expose database messages, passwords, tokens, or stack traces.

## 4. Authentication and account API

### Session behaviour

After a successful sign-up or sign-in, the backend sets an opaque session token in a cookie with these properties:

- `HttpOnly` — JavaScript cannot read it.
- `Secure` — it is sent only over HTTPS.
- `SameSite=Lax` — provides baseline cross-site request protection.
- Expiry: 14 days.

Logging out invalidates the matching server-side session immediately. The frontend discovers the current account through `GET /auth/session`; it never submits a `userId` to identify itself.

### Endpoints

| Method | Path | Purpose | Sign-in required |
|---|---|---|---|
| `POST` | `/auth/sign-up` | Create a parent account and start a session | No |
| `POST` | `/auth/sign-in` | Sign in with email and password | No |
| `POST` | `/auth/sign-out` | End the current session | Yes |
| `GET` | `/auth/session` | Load minimal current-account state | Yes |
| `PATCH` | `/account/password` | Change password using the current password | Yes |
| `POST` | `/auth/password-reset/request` | Email a one-time reset link | No |
| `POST` | `/auth/password-reset/confirm` | Set a new password from a valid reset link | No, reset token required |
| `DELETE` | `/account` | Immediately delete the account and its owned data | Yes |

#### `POST /auth/sign-up`

Creates a parent account. Email verification is intentionally not required for the beta.

```json
{
  "email": "parent@example.com",
  "password": "at-least-ten-characters"
}
```

The next onboarding step creates the child profile separately.

#### `POST /auth/sign-in`

```json
{
  "email": "parent@example.com",
  "password": "existing-password"
}
```

Sign-up, sign-in, and password-reset requests are rate limited. Passwords are stored only as strong password hashes.

#### `GET /auth/session`

Returns only what the app needs to decide whether to show onboarding or the home screen.

```json
{
  "data": {
    "user": {
      "id": "67bc...",
      "email": "parent@example.com"
    },
    "hasChildProfile": true
  }
}
```

#### `PATCH /account/password`

For a parent who knows their current password.

```json
{
  "currentPassword": "existing-password",
  "newPassword": "new-at-least-ten-character-password"
}
```

The current password must be correct before the new hash is saved.

#### Password reset flow

This serves a parent who has forgotten their current password. It is deliberately separate from changing a password while signed in.

`POST /auth/password-reset/request`

```json
{
  "email": "parent@example.com"
}
```

The API always returns the same success response, whether or not the email is registered. If valid, it sends a one-time link to the dedicated support email system. The token expires after 30 minutes.

`POST /auth/password-reset/confirm`

```json
{
  "token": "one-time-token-from-email",
  "newPassword": "new-at-least-ten-character-password"
}
```

The token can be used once only. A successful reset invalidates it.

#### `DELETE /account`

The parent must type their signed-in account email address exactly before this request is accepted.

```json
{
  "confirmationEmail": "parent@example.com"
}
```

Once confirmed, the service immediately deletes the account, child profiles, activity sessions, session-mission snapshots, favourites, feedback, authentication sessions, and password-reset tokens. Curated developer content is retained because it is not parent-owned. There is no recovery period.

## 5. Child profile and profile options API

The beta UI works with one child profile, so it uses a singular route. Internally the data model can support multiple profiles later.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/child-profile` | Create the parent’s first child profile during onboarding |
| `GET` | `/child-profile` | Load the active child profile |
| `PATCH` | `/child-profile` | Update child details and preferences |
| `GET` | `/profile-options` | Load curated interests and play-style choices |

#### `POST /child-profile`

```json
{
  "nickname": "Sam",
  "birthMonth": 6,
  "birthYear": 2022,
  "interestKeys": ["vehicles", "building"],
  "playStyleKeys": ["build", "pretend"]
}
```

The beta allows one active profile. The service rejects a second creation attempt under the beta entitlement, while the underlying design remains expandable.

#### `PATCH /child-profile`

Accepts any editable subset of the same fields. Updated age, interests, and play styles affect the very next recommendation; historic activity sessions remain unchanged.

#### `GET /profile-options`

Returns the developer-curated values shown in onboarding and profile editing. Keeping them server-managed means they can be adjusted without releasing a new frontend build.

```json
{
  "data": {
    "interests": [
      { "key": "vehicles", "label": "Vehicles" },
      { "key": "animals", "label": "Animals" }
    ],
    "playStyles": [
      { "key": "move", "label": "Move" },
      { "key": "build", "label": "Build" }
    ]
  }
}
```

There is no free-text “other interest” in the beta.

## 6. Guest samples and activity content API

Guests can explore the two selected sample Play Paths without creating an account. Guest use is read-only; no activity history or favourites are stored in the backend or carried into a new account.

| Method | Path | Purpose | Access |
|---|---|---|---|
| `GET` | `/guest/samples` | List the two available sample Play Paths | Guest |
| `GET` | `/guest/samples/:sampleId` | Read one sample with its ordered missions | Guest |
| `POST` | `/recommendations` | Return ranked suitable Play Paths | Signed-in parent |
| `GET` | `/play-paths/:playPathId` | Read a selected current Play Path with missions | Signed-in parent |
| `GET` | `/missions/:missionId` | Read a current standalone mission, including from Favourites | Signed-in parent |

### `POST /recommendations`

The parent sends the immediate situation. The backend combines it with the active child’s age band, interests, and play styles.

```json
{
  "availableMinutes": 20,
  "currentState": "ready_to_play",
  "constraints": ["small_space", "mostly_independent"],
  "themeKey": "vehicles"
}
```

`themeKey` is optional. Initial valid times are 10, 20, and 30 minutes. The API returns a short ranked list of plan cards rather than an unbounded catalogue.

```json
{
  "data": {
    "recommendations": [
      {
        "playPathId": "67bc...",
        "title": "Car City Builders",
        "durationMinutes": 20,
        "parentEffort": "check_in_occasionally",
        "matchType": "exact"
      }
    ]
  }
}
```

If no plan matches every preference, the API returns the closest suitable result with `matchType: "best_available"` and a short explanation. It does not leave the parent on an empty results screen.

## 7. Play-session API

An activity session begins only after a signed-in parent chooses a Play Path. Starting it creates snapshots of the selected plan and each ordered mission, preserving accurate history if developer content later changes.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/play-sessions` | Start a selected Play Path |
| `GET` | `/play-sessions/active` | Retrieve a resumable active session, if one exists |
| `GET` | `/play-sessions/:playSessionId` | Retrieve an owned active or historical session |
| `PATCH` | `/play-sessions/:playSessionId` | Complete or abandon the overall session |
| `PATCH` | `/play-sessions/:playSessionId/missions/:sessionMissionId` | Update one mission’s state, quick support signal, or replace it |
| `GET` | `/play-sessions/history` | List past completed or abandoned sessions |
| `POST` | `/play-sessions/:playSessionId/feedback` | Record optional plan-level feedback |

### `POST /play-sessions`

```json
{
  "playPathId": "67bc...",
  "selection": {
    "availableMinutes": 20,
    "currentState": "ready_to_play",
    "constraints": ["small_space", "mostly_independent"],
    "themeKey": "vehicles"
  }
}
```

The selection is saved as a lightweight snapshot for accurate history. The session is resumable for 24 hours.

### `PATCH /play-sessions/:playSessionId/missions/:sessionMissionId`

The same compact endpoint handles mission actions.

```json
{ "action": "complete" }
```

```json
{ "action": "skip" }
```

```json
{ "action": "signal", "signal": "bored" }
```

Supported quick signals are `bored`, `need_help`, and `calm`. Completing a mission returns the small Mission Wall progress update needed for the brief celebratory display. These signals are not exposed as permanent individual mission ratings in the beta.

#### Replacing a mission

When a parent needs an alternative, the same endpoint accepts:

```json
{ "action": "replace", "reason": "bored" }
```

The backend marks the original session mission `replaced`, finds one compatible alternative using the child profile and the session’s original setup choices, and creates a new immutable mission snapshot. The response returns that replacement immediately. It retains the original mission’s place in the plan and its Mission Wall reveal position.

If no suitable replacement exists, the response clearly says so and leaves the parent able to skip the mission or continue to the next one; it never silently changes the activity.

### `PATCH /play-sessions/:playSessionId`

```json
{ "action": "complete" }
```

or:

```json
{ "action": "abandon" }
```

The server validates the state transition. A completion action is safe to repeat, so an accidental double tap cannot create duplicate data.

### `GET /play-sessions/active`

Returns the parent’s resumable session if it is still within 24 hours. A scheduled task marks remaining active sessions as `expired` after that period. Expired sessions are not deleted; they remain available in history.

### `GET /play-sessions/history`

Returns the parent’s own completed and abandoned history in reverse chronological order, with cursor pagination if needed. The response uses the preserved session snapshots rather than current content instructions.

### `POST /play-sessions/:playSessionId/feedback`

Feedback is optional and applies to the completed overall Play Path—not to individual missions.

```json
{
  "overallRating": "loved_it",
  "reasonKeys": []
}
```

Valid ratings are `loved_it` and `okay`. Optional fixed reason keys are `too_easy`, `too_difficult`, `too_messy`, `lost_interest`, and `not_suitable`. There is no free-text feedback in the beta.

## 8. Favourites API

Parents can save both whole activity plans and individual missions.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/favourites` | Return saved Play Paths and saved missions in two sections |
| `PUT` | `/favourites/play-paths/:playPathId` | Save a Play Path |
| `DELETE` | `/favourites/play-paths/:playPathId` | Remove a saved Play Path |
| `PUT` | `/favourites/missions/:missionId` | Save a mission |
| `DELETE` | `/favourites/missions/:missionId` | Remove a saved mission |

`PUT` is intentionally idempotent: tapping Save more than once does not create duplicate favourite records. `DELETE` is likewise safe to repeat.

## 9. Recommendation rules and API boundaries

The beta recommendation process is rule-based:

1. Start with the child’s calculated age band, interests, and play styles.
2. Apply available time and any parent constraints.
3. Rank compatible current state/energy, interests, theme, and parent-effort label.
4. Lightly prefer favourites or successful past activities without forcing repetition.
5. If no exact match exists, relax the least important preference and return a clearly labelled best available choice.

This logic lives in a dedicated backend module. It is not embedded in the React client or tightly coupled to database queries, so it can evolve later without changing the API contract.

## 10. Security and operational safeguards

- All requests are HTTPS only.
- Zod validates input shapes, allowed values, string lengths, and action/state transitions.
- MongoDB validation provides a separate database-level safety check.
- Sign-up, sign-in, and password-reset requests are rate limited.
- Session cookies expire after 14 days, and sign-out invalidates server-side state immediately.
- Resource ownership is verified for profiles, sessions, feedback, and favourites on every request.
- The database is never called from the browser.
- There are no API endpoints for parent-facing content management in the beta. Curated content is added through reviewed developer updates.

## 11. Deferred API scope

Not required in the beta:

- Billing, subscriptions, and entitlement endpoints
- Multiple child-profile list/switch endpoints
- Parent-created activities or free-text interests
- Individual mission ratings
- Admin content-management endpoints
- Notifications and reminders
- Native-mobile-specific features

The `/api/v1` version, resource-based paths, and session authentication let these be added later without breaking the beta web application.


