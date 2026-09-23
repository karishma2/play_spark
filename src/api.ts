import type { GuestSample, GuestSampleSummary } from "./guestTypes";

interface ApiResponse<T> {
  data: T;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new ApiError("We couldn't load this Play Path. Please try again.");
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

export function getGuestSamples() {
  return getJson<GuestSampleSummary[]>("/api/v1/guest/samples");
}

export function getGuestSample(sampleId: string) {
  return getJson<GuestSample>(`/api/v1/guest/samples/${encodeURIComponent(sampleId)}`);
}
