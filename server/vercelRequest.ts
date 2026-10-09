import type { IncomingMessage } from "node:http";

/** Restore the public URL and let Express parse its query, rather than Vercel's rewrite query. */
export function restoreVercelRequestUrl(request: IncomingMessage) {
  const rewrittenUrl = new URL(request.url ?? "/", "https://play-spark.invalid");
  const forwardedPath = rewrittenUrl.searchParams.get("__path");
  // Vercel adds an own query property before Express receives the request,
  // even when request.url already contains the public URL.
  // Remove that shadow so Express's query getter reads the public URL.
  if (Object.hasOwn(request, "query")) Reflect.deleteProperty(request, "query");
  if (!forwardedPath) return;

  rewrittenUrl.searchParams.delete("__path");
  const query = rewrittenUrl.searchParams.toString();
  request.url = `/api/${forwardedPath.replace(/^\/+|\/+$/gu, "")}${query ? `?${query}` : ""}`;
}
