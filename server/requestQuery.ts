import type { Request } from "express";

/** Read the public query without relying on hosting-runtime query properties. */
export function publicRequestQuery(request: Request): Record<string, string | string[]> {
  const url = new URL(request.originalUrl, "https://play-spark.invalid");
  const query: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of url.searchParams) {
    const previous = query[key];
    query[key] = previous === undefined ? value : [...(Array.isArray(previous) ? previous : [previous]), value];
  }
  // Temporary production routing diagnostic: field categories only, never values.
  if (url.pathname.endsWith("/favourites") || url.pathname.endsWith("/history")) {
    request.res?.setHeader("X-Play-Spark-Query-Shape", JSON.stringify({
      fields: Object.keys(query).map((key) => ["limit", "before", "beforeId", "__path", "path"].includes(key) ? key : "other"),
      duplicateFields: Object.values(query).filter(Array.isArray).length,
    }));
  }
  return query;
}
