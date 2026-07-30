import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  emptySeverityCounts,
  type ScanCost,
  type ScanRun,
  type ScanStatus,
  type SeverityCounts,
} from "@csb/shared";
import { BENCHMARK_DB_PATH, DATA_DIR } from "./config.js";

export interface BenchmarkRow {
  id: string;
  display_name: string;
  repository_path: string | null;
  revision: string | null;
  scan_dir: string;
  status: string;
  model: string | null;
  effort: string | null;
  mode: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  estimated_usd: number | null;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  cache_write_tokens: number | null;
  output_tokens: number | null;
  severity_critical: number;
  severity_high: number;
  severity_medium: number;
  severity_low: number;
  severity_info: number;
  severity_unknown: number;
  severity_total: number;
  source: string;
  pid: number | null;
  created_at: string;
  updated_at: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(BENCHMARK_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      repository_path TEXT,
      revision TEXT,
      scan_dir TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT,
      effort TEXT,
      mode TEXT,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      estimated_usd REAL,
      input_tokens INTEGER,
      cached_input_tokens INTEGER,
      cache_write_tokens INTEGER,
      output_tokens INTEGER,
      severity_critical INTEGER NOT NULL DEFAULT 0,
      severity_high INTEGER NOT NULL DEFAULT 0,
      severity_medium INTEGER NOT NULL DEFAULT 0,
      severity_low INTEGER NOT NULL DEFAULT 0,
      severity_info INTEGER NOT NULL DEFAULT 0,
      severity_unknown INTEGER NOT NULL DEFAULT 0,
      severity_total INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      pid INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_by_updated ON runs(updated_at DESC);
  `);
  return db;
}

export function rowToScanRun(row: BenchmarkRow): ScanRun {
  const severity: SeverityCounts = {
    critical: row.severity_critical,
    high: row.severity_high,
    medium: row.severity_medium,
    low: row.severity_low,
    info: row.severity_info,
    unknown: row.severity_unknown,
    total: row.severity_total,
  };

  const cost: ScanCost | null =
    row.estimated_usd != null
      ? {
          estimatedUsd: row.estimated_usd,
          inputTokens: row.input_tokens ?? 0,
          cachedInputTokens: row.cached_input_tokens ?? 0,
          cacheWriteInputTokens: row.cache_write_tokens ?? 0,
          outputTokens: row.output_tokens ?? 0,
          model: row.model ?? undefined,
        }
      : null;

  return {
    id: row.id,
    displayName: row.display_name,
    repositoryPath: row.repository_path,
    revision: row.revision,
    scanDir: row.scan_dir,
    status: row.status as ScanStatus,
    model: row.model,
    effort: row.effort,
    mode: row.mode,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    cost,
    severity,
    source: row.source as ScanRun["source"],
    pid: row.pid,
  };
}

export function upsertRun(run: ScanRun): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO runs (
        id, display_name, repository_path, revision, scan_dir, status,
        model, effort, mode, started_at, completed_at, duration_ms,
        estimated_usd, input_tokens, cached_input_tokens, cache_write_tokens, output_tokens,
        severity_critical, severity_high, severity_medium, severity_low, severity_info, severity_unknown, severity_total,
        source, pid, created_at, updated_at
      ) VALUES (
        @id, @display_name, @repository_path, @revision, @scan_dir, @status,
        @model, @effort, @mode, @started_at, @completed_at, @duration_ms,
        @estimated_usd, @input_tokens, @cached_input_tokens, @cache_write_tokens, @output_tokens,
        @severity_critical, @severity_high, @severity_medium, @severity_low, @severity_info, @severity_unknown, @severity_total,
        @source, @pid, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        display_name=excluded.display_name,
        repository_path=excluded.repository_path,
        revision=excluded.revision,
        scan_dir=excluded.scan_dir,
        status=excluded.status,
        model=excluded.model,
        effort=excluded.effort,
        mode=excluded.mode,
        started_at=excluded.started_at,
        completed_at=excluded.completed_at,
        duration_ms=excluded.duration_ms,
        estimated_usd=excluded.estimated_usd,
        input_tokens=excluded.input_tokens,
        cached_input_tokens=excluded.cached_input_tokens,
        cache_write_tokens=excluded.cache_write_tokens,
        output_tokens=excluded.output_tokens,
        severity_critical=excluded.severity_critical,
        severity_high=excluded.severity_high,
        severity_medium=excluded.severity_medium,
        severity_low=excluded.severity_low,
        severity_info=excluded.severity_info,
        severity_unknown=excluded.severity_unknown,
        severity_total=excluded.severity_total,
        source=excluded.source,
        pid=excluded.pid,
        updated_at=excluded.updated_at`,
    )
    .run({
      id: run.id,
      display_name: run.displayName,
      repository_path: run.repositoryPath,
      revision: run.revision,
      scan_dir: run.scanDir,
      status: run.status,
      model: run.model,
      effort: run.effort,
      mode: run.mode,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      duration_ms: run.durationMs,
      estimated_usd: run.cost?.estimatedUsd ?? null,
      input_tokens: run.cost?.inputTokens ?? null,
      cached_input_tokens: run.cost?.cachedInputTokens ?? null,
      cache_write_tokens: run.cost?.cacheWriteInputTokens ?? null,
      output_tokens: run.cost?.outputTokens ?? null,
      severity_critical: run.severity.critical,
      severity_high: run.severity.high,
      severity_medium: run.severity.medium,
      severity_low: run.severity.low,
      severity_info: run.severity.info,
      severity_unknown: run.severity.unknown,
      severity_total: run.severity.total,
      source: run.source,
      pid: run.pid,
      created_at: now,
      updated_at: now,
    });
}

export function listRuns(): ScanRun[] {
  const rows = getDb()
    .prepare(`SELECT * FROM runs ORDER BY COALESCE(started_at, created_at) DESC`)
    .all() as BenchmarkRow[];
  return rows.map(rowToScanRun);
}

export function getRun(id: string): ScanRun | null {
  const row = getDb().prepare(`SELECT * FROM runs WHERE id = ?`).get(id) as
    | BenchmarkRow
    | undefined;
  return row ? rowToScanRun(row) : null;
}

export function deleteRun(id: string): void {
  getDb().prepare(`DELETE FROM runs WHERE id = ?`).run(id);
}

export function parseCostJson(raw: string | null | undefined): ScanCost | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      estimatedUsd: Number(parsed.estimatedUsd ?? 0),
      inputTokens: Number(parsed.inputTokens ?? 0),
      cachedInputTokens: Number(parsed.cachedInputTokens ?? 0),
      cacheWriteInputTokens: Number(parsed.cacheWriteInputTokens ?? 0),
      outputTokens: Number(parsed.outputTokens ?? 0),
      model: typeof parsed.model === "string" ? parsed.model : undefined,
    };
  } catch {
    return null;
  }
}

export function parseRecipe(raw: string | null | undefined): {
  model: string | null;
  effort: string | null;
  mode: string | null;
  repository: string | null;
} {
  if (!raw) {
    return { model: null, effort: null, mode: null, repository: null };
  }
  try {
    const parsed = JSON.parse(raw) as {
      mode?: string;
      repository?: string;
      config?: { model?: string; model_reasoning_effort?: string };
    };
    return {
      model: parsed.config?.model ?? null,
      effort: parsed.config?.model_reasoning_effort ?? null,
      mode: parsed.mode ?? null,
      repository: parsed.repository ?? null,
    };
  } catch {
    return { model: null, effort: null, mode: null, repository: null };
  }
}

export function mapWorkbenchStatus(status: string, canceledAt?: string | null): ScanStatus {
  if (canceledAt) return "cancelled";
  if (status === "complete") return "completed";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "incomplete";
}

export function durationMs(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const a = Date.parse(startedAt);
  const b = Date.parse(completedAt);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, b - a);
}

export function displayNameFromPaths(
  targetPath: string | null,
  scanDir: string,
): string {
  if (targetPath) return path.basename(targetPath);
  const parts = scanDir.split(path.sep).filter(Boolean);
  return parts[parts.length - 2] || parts[parts.length - 1] || "scan";
}

export { emptySeverityCounts };
