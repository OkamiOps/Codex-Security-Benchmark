export type Severity = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export type ScanStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "incomplete";

export type EffortLevel =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | "ultra";

export type ScanMode = "standard" | "deep";

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unknown: number;
  total: number;
}

export interface ScanCost {
  estimatedUsd: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  model?: string;
}

export interface ScanRun {
  id: string;
  displayName: string;
  repositoryPath: string | null;
  revision: string | null;
  scanDir: string;
  status: ScanStatus;
  model: string | null;
  effort: string | null;
  mode: ScanMode | string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  cost: ScanCost | null;
  severity: SeverityCounts;
  source: "workbench" | "benchmark" | "filesystem";
  pid: number | null;
}

export interface FindingSummary {
  findingId: string;
  occurrenceId: string | null;
  title: string;
  severity: Severity;
  confidence: string | null;
  ruleId: string | null;
  summary: string | null;
  primaryPath: string | null;
  fingerprints: string[];
}

export interface FindingDetail extends FindingSummary {
  attackPath: unknown;
  codeEvidence: unknown[];
  remediation: unknown;
  locations: unknown;
  taxonomy: unknown;
  rootCause: unknown;
  validation: unknown;
}

export interface MetricsSummary {
  totalScans: number;
  completedScans: number;
  totalEstimatedUsd: number;
  severity: SeverityCounts;
  byModelEffort: Array<{
    model: string;
    effort: string;
    runs: number;
    totalUsd: number;
    avgUsd: number;
    findingsHigh: number;
    findingsTotal: number;
    highPerDollar: number | null;
    totalPerDollar: number | null;
  }>;
  recent: ScanRun[];
}

export interface StartScanRequest {
  repositoryPath: string;
  model?: string;
  effort?: EffortLevel | string;
  mode?: ScanMode;
  maxCostUsd?: number;
  paths?: string[];
  displayName?: string;
}

export interface CompareRequest {
  scanIds: string[];
}

export interface CompareFindingBucket {
  key: string;
  title: string;
  severity: Severity;
  presentIn: string[];
}

export interface CompareResult {
  scans: ScanRun[];
  ranking: Array<{
    scanId: string;
    model: string | null;
    effort: string | null;
    estimatedUsd: number;
    findingsHigh: number;
    findingsTotal: number;
    highPerDollar: number | null;
    totalPerDollar: number | null;
    durationMs: number | null;
  }>;
  shared: CompareFindingBucket[];
  uniqueByScan: Record<string, CompareFindingBucket[]>;
}

export interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FsListResponse {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}

export interface CodexInfo {
  cliVersion?: string;
  sdkVersion?: string;
  model?: string;
  reasoningEffort?: string;
  raw: unknown;
}

export interface HealthResponse {
  ok: boolean;
  api: string;
  codexStateDir: string;
  codexInfo: CodexInfo | null;
  activeScanId: string | null;
}

export interface ScanEvent {
  type: "log" | "status" | "cost" | "done" | "error";
  at: string;
  message?: string;
  status?: ScanStatus;
  cost?: Partial<ScanCost>;
  scan?: ScanRun;
}

export function emptySeverityCounts(): SeverityCounts {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    total: 0,
  };
}

export function normalizeSeverity(value: unknown): Severity {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "level" in value
        ? String((value as { level: unknown }).level)
        : "unknown";
  const s = raw.toLowerCase();
  if (
    s === "critical" ||
    s === "high" ||
    s === "medium" ||
    s === "low" ||
    s === "info"
  ) {
    return s;
  }
  return "unknown";
}
