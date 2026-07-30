import fs from "node:fs";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import {
  API_HOST,
  API_PORT,
  DATA_DIR,
  RUNS_DIR,
} from "./config.js";
import { getDb } from "./db.js";
import { importExternalScans } from "./ingest.js";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(RUNS_DIR, { recursive: true });
getDb();

const { imported } = importExternalScans();
console.log(`[csb-api] Indexed ${imported} scan(s) from Codex Security state`);

serve(
  {
    fetch: app.fetch,
    hostname: API_HOST,
    port: API_PORT,
  },
  (info) => {
    console.log(`[csb-api] Listening on http://${info.address}:${info.port}`);
  },
);
