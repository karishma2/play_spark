import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";
import { restoreVercelRequestUrl } from "../server/vercelRequest.js";

test("Vercel wildcard cleanup preserves unrelated and duplicate query fields", () => {
  for (const query of ["path=unrelated", "path=v1/favourites&path=unrelated", "userId=other", "limit=10&limit=1"]) {
    const incoming = { url: `/api/v1/favourites?${query}` } as IncomingMessage;
    restoreVercelRequestUrl(incoming);
    assert.equal(incoming.url, `/api/v1/favourites?${query}`);
  }
  const incoming = { url: "/api/v1/favourites?path=v1%2Ffavourites&limit=10" } as IncomingMessage;
  restoreVercelRequestUrl(incoming);
  assert.equal(incoming.url, "/api/v1/favourites?limit=10");
});
