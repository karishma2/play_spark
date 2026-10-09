import type { Request } from "express";

/** Read the public query without relying on hosting-runtime query properties. */
export function publicRequestQuery(request: Request): Record<string, string | string[]> {
  const url = new URL(request.originalUrl, "https://play-spark.invalid");
  const query: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    const previous = query[key];
    query[key] = previous === undefined ? value : [...(Array.isArray(previous) ? previous : [previous]), value];
  }
  return query;
}
