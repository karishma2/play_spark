# 0005 — Store curated profile options in MongoDB

- **Status:** Accepted
- **Date:** 25 September 2026

## Context

Child onboarding needs a controlled list of interests and play styles. The browser must not own the allowed values, and the beta team needs to update reviewed options without changing frontend code.

## Decision

Store enabled profile options in a `profileOptions` MongoDB collection. Manage the collection through a version-controlled, schema-validated `content/profile-options.json` file and a repeatable seed command. The API returns enabled options in reviewed order and validates submitted child-profile keys against them.

## Consequences

Profile choices stay consistent across the UI, API, and future recommendation logic. Deployments must run the profile-option seed before onboarding is used. Content changes remain reviewed repository changes and do not require a frontend implementation change.
