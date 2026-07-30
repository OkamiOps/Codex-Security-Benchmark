import type {
  CompareFindingBucket,
  CompareResult,
  FindingDetail,
  ScanRun,
} from "@csb/shared";
import { getRun } from "./db.js";
import { readFindingsFile } from "./ingest.js";

function findingKey(f: FindingDetail): string {
  if (f.fingerprints[0]) return f.fingerprints[0];
  if (f.findingId) return f.findingId;
  return `${f.title}::${f.primaryPath ?? ""}`;
}

export function compareScans(scanIds: string[]): CompareResult {
  if (scanIds.length < 2) {
    throw new Error("Selecione pelo menos 2 scans para comparar");
  }

  const scans: ScanRun[] = [];
  const findingsByScan = new Map<string, FindingDetail[]>();

  for (const id of scanIds) {
    const run = getRun(id);
    if (!run) throw new Error(`Scan não encontrado: ${id}`);
    scans.push(run);
    findingsByScan.set(id, readFindingsFile(run.scanDir));
  }

  const allKeys = new Map<string, CompareFindingBucket>();
  for (const scan of scans) {
    const findings = findingsByScan.get(scan.id) ?? [];
    for (const f of findings) {
      const key = findingKey(f);
      const existing = allKeys.get(key);
      if (existing) {
        if (!existing.presentIn.includes(scan.id)) existing.presentIn.push(scan.id);
      } else {
        allKeys.set(key, {
          key,
          title: f.title,
          severity: f.severity,
          presentIn: [scan.id],
        });
      }
    }
  }

  const shared: CompareFindingBucket[] = [];
  const uniqueByScan: Record<string, CompareFindingBucket[]> = {};
  for (const id of scanIds) uniqueByScan[id] = [];

  for (const bucket of allKeys.values()) {
    if (bucket.presentIn.length === scans.length) {
      shared.push(bucket);
    } else if (bucket.presentIn.length === 1) {
      uniqueByScan[bucket.presentIn[0]].push(bucket);
    }
  }

  const ranking = scans.map((scan) => {
    const usd = scan.cost?.estimatedUsd ?? 0;
    const high = scan.severity.high + scan.severity.critical;
    const total = scan.severity.total;
    return {
      scanId: scan.id,
      model: scan.model,
      effort: scan.effort,
      estimatedUsd: usd,
      findingsHigh: high,
      findingsTotal: total,
      highPerDollar: usd > 0 ? high / usd : null,
      totalPerDollar: usd > 0 ? total / usd : null,
      durationMs: scan.durationMs,
    };
  });

  ranking.sort((a, b) => {
    const av = a.highPerDollar ?? -1;
    const bv = b.highPerDollar ?? -1;
    return bv - av;
  });

  return { scans, ranking, shared, uniqueByScan };
}
