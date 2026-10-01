# 0007 — Private-beta email verification policy

## Status

Accepted — 30 September 2026

## Context

Production email delivery requires a sender domain that the project does not yet own. Requiring verification prevents invited beta parents from reaching authenticated child-profile and activity features, while removing the verification implementation would create avoidable rework and weaken the future production design.

## Decision

Control the account verification gate with the server-side `REQUIRE_EMAIL_VERIFICATION` setting. It defaults to `true`. The controlled private beta may set it to `false`, which skips verification-email delivery, treats signed-in accounts as eligible for parent features, and records newly created accounts with `emailVerificationRequired: false`. Those accounts remain exempt when verification is enabled later. The verification routes, token storage, and email sender remain available for production activation.

## Consequences

Beta participants can mistype or use an email address they do not own. Password recovery still depends on working email delivery. The private beta must control who receives access, and production launch remains blocked on a verified sending domain and successful verification and reset-email smoke tests.
