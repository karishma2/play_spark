import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { restoreVercelRequestUrl } from "../server/vercelRequest.js";

const app = createApp(loadConfig());

export default function handler(request: IncomingMessage, response: ServerResponse) {
  restoreVercelRequestUrl(request);
  return app(request, response);
}
