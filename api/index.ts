import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";

const app = createApp(loadConfig());

export default function handler(request: IncomingMessage, response: ServerResponse) {
  const rewrittenUrl = new URL(request.url ?? "/", "https://play-spark.invalid");
  const forwardedPath = rewrittenUrl.searchParams.get("__path");

  if (forwardedPath) {
    rewrittenUrl.searchParams.delete("__path");
    const query = rewrittenUrl.searchParams.toString();
    request.url = `/api/${forwardedPath.replace(/^\/+|\/+$/gu, "")}${query ? `?${query}` : ""}`;
  }

  return app(request, response);
}
