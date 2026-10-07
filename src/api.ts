import type { GuestSample, GuestSampleSummary } from "./guestTypes";

interface ApiResponse<T> {
  data: T;
}

interface ApiErrorPayload {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
}

export interface AuthSession {
  user: { id: string; email: string };
  hasChildProfile: boolean;
  emailVerified: boolean;
}

export class ApiError extends Error {
  code?: string;
  fieldErrors?: Record<string, string>;

  constructor(message: string, payload?: ApiErrorPayload["error"]) {
    super(message);
    this.name = "ApiError";
    this.code = payload?.code;
    this.fieldErrors = payload?.fieldErrors;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw new ApiError(payload.error?.message ?? "Please try again.", payload.error);
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export function getGuestSamples() {
  return requestJson<GuestSampleSummary[]>("/api/v1/guest/samples");
}

export function getGuestSample(sampleId: string) {
  return requestJson<GuestSample>(`/api/v1/guest/samples/${encodeURIComponent(sampleId)}`);
}

export function getPlayPath(playPathId: string) {
  return requestJson<GuestSample>(`/api/v1/play-paths/${encodeURIComponent(playPathId)}`);
}

export type PlaySessionStatus = "active" | "completed" | "abandoned";
export type MissionSkipReason = "missing_materials" | "too_messy_or_noisy" | "too_much_parent_help" | "child_not_interested" | "something_else";

export interface MissionReplacement {
  originalMissionId: string;
  replacementMission: GuestSample["missions"][number];
  reason: MissionSkipReason;
  replacedAt: string;
}

export interface PlaySession {
  id: string;
  childProfileId: string;
  status: PlaySessionStatus;
  playPath: GuestSample;
  completedMissionIds: string[];
  missionReplacements: MissionReplacement[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  abandonedAt?: string;
}

export function getActivePlaySession() {
  return requestJson<PlaySession | null>("/api/v1/play-sessions/active");
}

export function startPlaySession(playPathId: string) {
  return postJson<PlaySession>("/api/v1/play-sessions", { playPathId });
}

export function completePlaySessionMission(sessionId: string, missionId: string) {
  return postJson<PlaySession>(
    `/api/v1/play-sessions/${encodeURIComponent(sessionId)}/missions/${encodeURIComponent(missionId)}/complete`,
    {},
  );
}

export function skipPlaySessionMission(sessionId: string, missionId: string, reason: MissionSkipReason) {
  return postJson<PlaySession>(
    `/api/v1/play-sessions/${encodeURIComponent(sessionId)}/missions/${encodeURIComponent(missionId)}/skip`,
    { reason },
  );
}

export function abandonPlaySession(sessionId: string) {
  return postJson<PlaySession>(`/api/v1/play-sessions/${encodeURIComponent(sessionId)}/abandon`, {});
}

function submitCredentials(path: string, email: string, password: string) {
  return requestJson<AuthSession>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function signUp(email: string, password: string) {
  return submitCredentials("/api/v1/auth/sign-up", email, password);
}

export function signIn(email: string, password: string) {
  return submitCredentials("/api/v1/auth/sign-in", email, password);
}

export function getAuthSession() {
  return requestJson<AuthSession>("/api/v1/auth/session");
}

export function signOut() {
  return requestJson<{ signedOut: true }>("/api/v1/auth/sign-out", { method: "POST" });
}

export interface ProfileOption {
  key: string;
  label: string;
}

export interface ProfileOptions {
  interests: ProfileOption[];
  playStyles: ProfileOption[];
}

export interface ChildProfileInput {
  nickname?: string;
  birthMonth: number;
  birthYear: number;
  interestKeys: string[];
  playStyleKeys: string[];
}

export interface ChildProfile extends ChildProfileInput {
  id: string;
}

export type RecommendationState = "calm" | "ready_to_play" | "full_energy";
export type RecommendationConstraint = "small_space" | "quiet" | "low_mess" | "mostly_independent";

export interface RecommendationSelection {
  availableMinutes: 10 | 20 | 30;
  currentState: RecommendationState;
  constraints: RecommendationConstraint[];
  themeKey?: string;
}

export interface RecommendationCard {
  playPathId: string;
  title: string;
  summary: string;
  goal: string;
  supports: string[];
  durationMinutes: number;
  setupMinutes: number;
  parentEffort: "independent_after_setup" | "check_in_occasionally" | "parent_guided";
  imageUrl: string;
  imageAlt: string;
  materials: string[];
  matchType: "exact" | "best_available";
  explanation: string;
}

function postJson<T>(path: string, body: unknown) {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return postJson<{ changed: true }>("/api/v1/auth/change-password", { currentPassword, newPassword });
}

export function requestPasswordReset(email: string) {
  return postJson<{ accepted: true }>("/api/v1/auth/request-password-reset", { email });
}

export function resetPassword(token: string, newPassword: string) {
  return postJson<{ reset: true }>("/api/v1/auth/reset-password", { token, newPassword });
}

export function requestEmailVerification() {
  return postJson<{ accepted: true }>("/api/v1/auth/request-email-verification", {});
}

export function verifyEmail(token: string) {
  return postJson<{ verified: true }>("/api/v1/auth/verify-email", { token });
}

export function getProfileOptions() {
  return requestJson<ProfileOptions>("/api/v1/profile-options");
}

export function createChildProfile(input: ChildProfileInput) {
  return postJson<ChildProfile>("/api/v1/child-profile", input);
}

export function getChildProfile() {
  return requestJson<ChildProfile>("/api/v1/child-profile");
}

export function updateChildProfile(input: ChildProfileInput) {
  return requestJson<ChildProfile>("/api/v1/child-profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getRecommendations(selection: RecommendationSelection) {
  return postJson<{ recommendations: RecommendationCard[] }>("/api/v1/recommendations", selection);
}
