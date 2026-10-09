import type { IncomingMessage } from "node:http";

/** Restore the public URL and let Express parse its query, rather than Vercel's rewrite query. */
export function restoreVercelRequestUrl(request: IncomingMessage) {
  const rewrittenUrl = new URL(request.url ?? "/", "https://play-spark.invalid");
  const forwardedPath = rewrittenUrl.searchParams.get("__path");
  // Vercel adds an own query property before Express receives the request,
  // even when request.url already contains the public URL.
  // Remove that shadow so Express's query getter reads the public URL.
  if (Object.hasOwn(request, "query")) Reflect.deleteProperty(request, "query");
  if (forwardedPath) {
    rewrittenUrl.searchParams.delete("__path");
    rewrittenUrl.pathname = `/api/${forwardedPath.replace(/^\/+|\/+$/gu, "")}`;
  }
  // Vercel also forwards the source wildcard as `path`, including when url
  // already has the public pathname. Remove only the matching routing value;
  // unrelated or repeated fields must still reach strict route validation.
  const routePath = rewrittenUrl.pathname.replace(/^\/api\//u, "");
  const wildcardValues = rewrittenUrl.searchParams.getAll("path");
  if (rewrittenUrl.pathname.startsWith("/api/") && wildcardValues.length === 1 && wildcardValues[0] === routePath) {
    rewrittenUrl.searchParams.delete("path");
  }
  request.url = `${rewrittenUrl.pathname}${rewrittenUrl.search}`;
  // Express preserves an existing originalUrl. A hosting wrapper can populate it
  // before this adapter runs, leaving rewrite metadata after url is restored.
  Object.assign(request, { originalUrl: request.url ?? "/" });
}
