import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  emptySeverityCounts,
  normalizeSeverity,
  type FindingDetail,
  type FindingSummary,
  type ScanRun,
  type SeverityCounts,
} from "@csb/shared";
import { SCANS_ROOT, WORKBENCH_DB_PATH } from "./config.js";
import {
  displayNameFromPaths,
  durationMs,
  mapWorkbenchStatus,
  parseCostJson,
  parseRecipe,
  upsertRun,
} from "./db.js";

interface WorkbenchScanRow {
  id: string;
  target_path: string;
  target_revision: string;
  scan_dir: string;
  status: string;
  mode: string;
  started_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  recipe_json: string | null;
  cost_json: string | null;
  target_summary: string | null;
}

function countSeverityFromFindings(findingsPath: string): SeverityCounts {
  const counts = emptySeverityCounts();
  if (!fs.existsSync(findingsPath)) return counts;
  try {
    const raw = JSON.parse(fs.readFileSync(findingsPath, "utf8")) as {
      findings?: Array<{ severity?: unknown }>;
    };
    for (const f of raw.findings ?? []) {
      const sev = normalizeSeverity(f.severity);
      counts[sev] += 1;
      counts.total += 1;
    }
  } catch {
    // ignore malformed findings
  }
  return counts;
}

export function readFindingsFile(scanDir: string): FindingDetail[] {
  const findingsPath = path.join(scanDir, "findings.json");
  if (!fs.existsSync(findingsPath)) return [];
  const raw = JSON.parse(fs.readFileSync(findingsPath, "utf8")) as {
    findings?: Array<Record<string, unknown>>;
  };
  return (raw.findings ?? []).map((f) => {
    const locations = Array.isArray(f.locations) ? f.locations : [];
    const primary =
      locations.find(
        (l) =>
          l &&
          typeof l === "object" &&
          "path" in l &&
          typeof (l as { path: unknown }).path === "string",
      ) ??
      (Array.isArray(f.codeEvidence)
        ? f.codeEvidence.find(
            (e) =>
              e &&
              typeof e === "object" &&
              "path" in e &&
              typeof (e as { path: unknown }).path === "string",
          )
        : null);

    const fingerprints: string[] = [];
    if (f.fingerprints && typeof f.fingerprints === "object") {
      for (const v of Object.values(f.fingerprints as Record<string, unknown>)) {
        if (typeof v === "string") fingerprints.push(v);
      }
    }
    if (typeof f.findingId === "string") fingerprints.push(f.findingId);

    const primaryPath =
      primary && typeof primary === "object" && "path" in primary
        ? String((primary as { path: string }).path)
        : null;

    return {
      findingId: String(f.findingId ?? f.occurrenceId ?? cryptoRandom()),
      occurrenceId: typeof f.occurrenceId === "string" ? f.occurrenceId : null,
      title: String(f.title ?? "Untitled finding"),
      severity: normalizeSeverity(f.severity),
      confidence: typeof f.confidence === "string" ? f.confidence : null,
      ruleId: typeof f.ruleId === "string" ? f.ruleId : null,
      summary: typeof f.summary === "string" ? f.summary : null,
      primaryPath,
      fingerprints,
      attackPath: f.attackPath ?? null,
      codeEvidence: Array.isArray(f.codeEvidence) ? f.codeEvidence : [],
      remediation: f.remediation ?? null,
      locations: f.locations ?? null,
      taxonomy: f.taxonomy ?? null,
      rootCause: f.rootCause ?? null,
      validation: f.validation ?? null,
    };
  });
}

export function toFindingSummaries(details: FindingDetail[]): FindingSummary[] {
  return details.map(
    ({
      findingId,
      occurrenceId,
      title,
      severity,
      confidence,
      ruleId,
      summary,
      primaryPath,
      fingerprints,
    }) => ({
      findingId,
      occurrenceId,
      title,
      severity,
      confidence,
      ruleId,
      summary,
      primaryPath,
      fingerprints,
    }),
  );
}

function cryptoRandom(): string {
  return `unknown-${Math.random().toString(36).slice(2)}`;
}

function workbenchRowToScanRun(row: WorkbenchScanRow): ScanRun {
  const recipe = parseRecipe(row.recipe_json);
  const cost = parseCostJson(row.cost_json);
  const findingsPath = path.join(row.scan_dir, "findings.json");
  const severity = countSeverityFromFindings(findingsPath);
  return {
    id: row.id,
    displayName: displayNameFromPaths(row.target_path, row.scan_dir),
    repositoryPath: recipe.repository ?? row.target_path,
    revision: row.target_revision,
    scanDir: row.scan_dir,
    status: mapWorkbenchStatus(row.status, row.canceled_at),
    model: recipe.model ?? cost?.model ?? null,
    effort: recipe.effort,
    mode: recipe.mode ?? row.mode,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: durationMs(row.started_at, row.completed_at),
    cost,
    severity,
    source: "workbench",
    pid: null,
  };
}

export function readWorkbenchScans(): ScanRun[] {
  if (!fs.existsSync(WORKBENCH_DB_PATH)) return [];
  try {
    const wb = new Database(WORKBENCH_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const rows = wb
        .prepare(
          `SELECT id, target_path, target_revision, scan_dir, status, mode,
                  started_at, completed_at, canceled_at, recipe_json, cost_json, target_summary
           FROM scans
           ORDER BY started_at DESC`,
        )
        .all() as WorkbenchScanRow[];
      return rows.map(workbenchRowToScanRun);
    } finally {
      wb.close();
    }
  } catch {
    return [];
  }
}

export function readWorkbenchScan(id: string): ScanRun | null {
  if (!fs.existsSync(WORKBENCH_DB_PATH)) return null;
  try {
    const wb = new Database(WORKBENCH_DB_PATH, { readonly: true, fileMustExist: true });
    try {
      const row = wb
        .prepare(
          `SELECT id, target_path, target_revision, scan_dir, status, mode,
                  started_at, completed_at, canceled_at, recipe_json, cost_json, target_summary
           FROM scans WHERE id = ?`,
        )
        .get(id) as WorkbenchScanRow | undefined;
      return row ? workbenchRowToScanRun(row) : null;
    } finally {
      wb.close();
    }
  } catch {
    return null;
  }
}

function findManifestDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((e) => e.isFile() && e.name === "scan-manifest.json")) {
      results.push(current);
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        stack.push(path.join(current, e.name));
      }
    }
  }
  return results;
}

export function readFilesystemScans(): ScanRun[] {
  const dirs = findManifestDirs(SCANS_ROOT);
  const runs: ScanRun[] = [];
  for (const scanDir of dirs) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(scanDir, "scan-manifest.json"), "utf8"),
      ) as {
        scan?: {
          id?: string;
          status?: string;
          startedAt?: string;
          completedAt?: string;
          target?: { displayName?: string; revision?: string };
        };
      };
      const id = manifest.scan?.id;
      if (!id) continue;
      const severity = countSeverityFromFindings(path.join(scanDir, "findings.json"));
      runs.push({
        id,
        displayName:
          manifest.scan?.target?.displayName ??
          displayNameFromPaths(null, scanDir),
        repositoryPath: null,
        revision: manifest.scan?.target?.revision ?? null,
        scanDir,
        status: mapWorkbenchStatus(manifest.scan?.status ?? "complete"),
        model: null,
        effort: null,
        mode: null,
        startedAt: manifest.scan?.startedAt ?? null,
        completedAt: manifest.scan?.completedAt ?? null,
        durationMs: durationMs(
          manifest.scan?.startedAt ?? null,
          manifest.scan?.completedAt ?? null,
        ),
        cost: null,
        severity,
        source: "filesystem",
        pid: null,
      });
    } catch {
      // skip
    }
  }
  return runs;
}

export function importExternalScans(): { imported: number } {
  const byId = new Map<string, ScanRun>();
  for (const run of readFilesystemScans()) byId.set(run.id, run);
  for (const run of readWorkbenchScans()) byId.set(run.id, run);

  let imported = 0;
  for (const run of byId.values()) {
    upsertRun(run);
    imported += 1;
  }
  return { imported };
}

export function refreshRunFromDisk(id: string): ScanRun | null {
  const fromWb = readWorkbenchScan(id);
  if (fromWb) {
    upsertRun(fromWb);
    return fromWb;
  }
  return null;
}
