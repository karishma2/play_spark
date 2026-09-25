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
