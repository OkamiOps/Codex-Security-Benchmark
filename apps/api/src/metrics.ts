import { emptySeverityCounts, type MetricsSummary, type SeverityCounts } from "@csb/shared";
import { listRuns } from "./db.js";

export function buildMetricsSummary(): MetricsSummary {
  const runs = listRuns();
  const severity = emptySeverityCounts();
  let totalEstimatedUsd = 0;
  let completedScans = 0;

  const groups = new Map<
    string,
    {
      model: string;
      effort: string;
      runs: number;
      totalUsd: number;
      findingsHigh: number;
      findingsTotal: number;
    }
  >();

  for (const run of runs) {
    if (run.status === "completed") completedScans += 1;
    totalEstimatedUsd += run.cost?.estimatedUsd ?? 0;
    addSeverity(severity, run.severity);

    const model = run.model ?? "unknown";
    const effort = run.effort ?? "unknown";
    const key = `${model}::${effort}`;
    const g = groups.get(key) ?? {
      model,
      effort,
      runs: 0,
      totalUsd: 0,
      findingsHigh: 0,
      findingsTotal: 0,
    };
    g.runs += 1;
    g.totalUsd += run.cost?.estimatedUsd ?? 0;
    g.findingsHigh += run.severity.high + run.severity.critical;
    g.findingsTotal += run.severity.total;
    groups.set(key, g);
  }

  const byModelEffort = [...groups.values()]
    .map((g) => ({
      ...g,
      avgUsd: g.runs > 0 ? g.totalUsd / g.runs : 0,
      highPerDollar: g.totalUsd > 0 ? g.findingsHigh / g.totalUsd : null,
      totalPerDollar: g.totalUsd > 0 ? g.findingsTotal / g.totalUsd : null,
    }))
    .sort((a, b) => (b.highPerDollar ?? -1) - (a.highPerDollar ?? -1));

  return {
    totalScans: runs.length,
    completedScans,
    totalEstimatedUsd,
    severity,
    byModelEffort,
    recent: runs.slice(0, 8),
  };
}

function addSeverity(target: SeverityCounts, source: SeverityCounts): void {
  target.critical += source.critical;
  target.high += source.high;
  target.medium += source.medium;
  target.low += source.low;
  target.info += source.info;
  target.unknown += source.unknown;
  target.total += source.total;
}
