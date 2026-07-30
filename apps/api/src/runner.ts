import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { ScanCost, ScanEvent, ScanRun, StartScanRequest } from "@csb/shared";
import { emptySeverityCounts } from "@csb/shared";
import {
  CODEX_SECURITY_ARGS_PREFIX,
  CODEX_SECURITY_BIN,
  CODEX_SECURITY_STATE_DIR,
  RUNS_DIR,
  SCANS_ROOT,
} from "./config.js";
import { getRun, upsertRun } from "./db.js";
import { refreshRunFromDisk } from "./ingest.js";

type Listener = (event: ScanEvent) => void;

interface ActiveScan {
  id: string;
  child: ChildProcess;
  listeners: Set<Listener>;
  logBuffer: ScanEvent[];
}

const active = new Map<string, ActiveScan>();

function emit(scan: ActiveScan, event: Omit<ScanEvent, "at"> & { at?: string }): void {
  const full: ScanEvent = { ...event, at: event.at ?? new Date().toISOString() };
  scan.logBuffer.push(full);
  if (scan.logBuffer.length > 500) scan.logBuffer.shift();
  for (const listener of scan.listeners) listener(full);
}

export function getActiveScanId(): string | null {
  for (const [id] of active) return id;
  return null;
}

export function subscribe(scanId: string, listener: Listener): () => void {
  const scan = active.get(scanId);
  if (!scan) {
    listener({
      type: "error",
      at: new Date().toISOString(),
      message: "Scan não está ativo",
    });
    return () => undefined;
  }
  for (const past of scan.logBuffer) listener(past);
  scan.listeners.add(listener);
  return () => scan.listeners.delete(listener);
}

function safeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
}

export async function startScan(req: StartScanRequest): Promise<ScanRun> {
  if (active.size > 0) {
    throw new Error("Já existe um scan em execução. Cancele-o antes de iniciar outro.");
  }

  const repositoryPath = path.resolve(req.repositoryPath);
  if (!fs.existsSync(repositoryPath) || !fs.statSync(repositoryPath).isDirectory()) {
    throw new Error(`Repositório inválido: ${repositoryPath}`);
  }

  const displayName = req.displayName?.trim() || path.basename(repositoryPath);
  const id = nanoid(12);
  const outputDir = path.join(SCANS_ROOT, safeName(displayName), `csb-${safeName(displayName)}-${id}`);
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  const model = req.model || "gpt-5.6-sol";
  const effort = req.effort || "high";
  const mode = req.mode || "standard";

  const args = [
    ...CODEX_SECURITY_ARGS_PREFIX,
    "scan",
    repositoryPath,
    "--model",
    model,
    "--effort",
    String(effort),
    "--mode",
    mode,
    "--output-dir",
    outputDir,
    "--json",
  ];

  if (req.maxCostUsd != null && req.maxCostUsd > 0) {
    args.push("--max-cost", String(req.maxCostUsd));
  }
  for (const p of req.paths ?? []) {
    if (p.trim()) args.push("--path", p.trim());
  }

  const startedAt = new Date().toISOString();
  const run: ScanRun = {
    id,
    displayName,
    repositoryPath,
    revision: null,
    scanDir: outputDir,
    status: "running",
    model,
    effort: String(effort),
    mode,
    startedAt,
    completedAt: null,
    durationMs: null,
    cost: {
      estimatedUsd: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      model,
    },
    severity: emptySeverityCounts(),
    source: "benchmark",
    pid: null,
  };
  upsertRun(run);

  const child = spawn(CODEX_SECURITY_BIN, args, {
    cwd: repositoryPath,
    env: {
      ...process.env,
      CODEX_SECURITY_STATE_DIR,
      CI: "1",
      NO_COLOR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  run.pid = child.pid ?? null;
  upsertRun(run);

  const activeScan: ActiveScan = {
    id,
    child,
    listeners: new Set(),
    logBuffer: [],
  };
  active.set(id, activeScan);

  emit(activeScan, {
    type: "status",
    status: "running",
    message: `Iniciando: ${CODEX_SECURITY_BIN} ${args.join(" ")}`,
    scan: run,
  });

  const onChunk = (chunk: Buffer, stream: "stdout" | "stderr") => {
    const text = chunk.toString("utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      emit(activeScan, {
        type: "log",
        message: `[${stream}] ${line}`,
      });
      maybeParseCost(line, activeScan, run);
    }
  };

  child.stdout?.on("data", (c: Buffer) => onChunk(c, "stdout"));
  child.stderr?.on("data", (c: Buffer) => onChunk(c, "stderr"));

  child.on("error", (err) => {
    run.status = "failed";
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.parse(run.completedAt) - Date.parse(startedAt);
    run.pid = null;
    upsertRun(run);
    emit(activeScan, {
      type: "error",
      message: err.message,
      status: "failed",
      scan: run,
    });
    active.delete(id);
  });

  child.on("close", (code) => {
    const refreshed = refreshAfterClose(outputDir, run);
    if (code === 0 || refreshed.status === "completed") {
      refreshed.status = refreshed.status === "failed" ? "failed" : "completed";
    } else if (refreshed.status === "cancelled") {
      // keep
    } else {
      refreshed.status = code === null ? "cancelled" : "failed";
    }
    refreshed.completedAt = refreshed.completedAt ?? new Date().toISOString();
    refreshed.durationMs =
      refreshed.durationMs ??
      (Date.parse(refreshed.completedAt) - Date.parse(startedAt));
    refreshed.pid = null;
    upsertRun(refreshed);
    emit(activeScan, {
      type: "done",
      status: refreshed.status,
      message: `Scan finalizado (exit ${code})`,
      scan: refreshed,
      cost: refreshed.cost ?? undefined,
    });
    active.delete(id);
  });

  return run;
}

function maybeParseCost(line: string, activeScan: ActiveScan, run: ScanRun): void {
  // Heuristics from CLI progress lines
  const usd = line.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:USD|usd)/i);
  const tokens = line.match(/([0-9,]+)\s+tokens?/i);
  if (!usd && !tokens) return;

  const cost: ScanCost = {
    estimatedUsd: usd ? Number(usd[1]) : run.cost?.estimatedUsd ?? 0,
    inputTokens: run.cost?.inputTokens ?? 0,
    cachedInputTokens: run.cost?.cachedInputTokens ?? 0,
    cacheWriteInputTokens: run.cost?.cacheWriteInputTokens ?? 0,
    outputTokens: run.cost?.outputTokens ?? 0,
    model: run.model ?? undefined,
  };
  if (tokens) {
    cost.inputTokens = Number(tokens[1].replace(/,/g, ""));
  }
  run.cost = cost;
  upsertRun(run);
  emit(activeScan, { type: "cost", cost, scan: run });
}

function refreshAfterClose(outputDir: string, fallback: ScanRun): ScanRun {
  // Try to pick up official workbench id if created
  try {
    const manifestPath = path.join(outputDir, "scan-manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        scan?: { id?: string };
      };
      const officialId = manifest.scan?.id;
      if (officialId) {
        const official = refreshRunFromDisk(officialId);
        if (official) {
          // Keep our benchmark id as primary key but merge metrics
          return {
            ...official,
            id: fallback.id,
            source: "benchmark",
            model: official.model ?? fallback.model,
            effort: official.effort ?? fallback.effort,
            scanDir: official.scanDir || fallback.scanDir,
          };
        }
      }
    }
  } catch {
    // fall through
  }
  const existing = getRun(fallback.id) ?? fallback;
  return existing;
}

export function cancelScan(id: string): boolean {
  const scan = active.get(id);
  if (!scan) return false;
  scan.child.kill("SIGTERM");
  setTimeout(() => {
    if (!scan.child.killed) scan.child.kill("SIGKILL");
  }, 5000);
  const run = getRun(id);
  if (run) {
    run.status = "cancelled";
    run.completedAt = new Date().toISOString();
    run.pid = null;
    if (run.startedAt) {
      run.durationMs = Date.parse(run.completedAt) - Date.parse(run.startedAt);
    }
    upsertRun(run);
    emit(scan, {
      type: "status",
      status: "cancelled",
      message: "Cancelamento solicitado",
      scan: run,
    });
  }
  return true;
}
