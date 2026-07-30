import type {
  CompareRequest,
  CompareResult,
  FindingDetail,
  FindingSummary,
  FsListResponse,
  HealthResponse,
  MetricsSummary,
  ScanRun,
  StartScanRequest,
} from "@csb/shared";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `HTTP ${res.status}`,
    );
  }
  return data;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  ingest: () => request<{ imported: number }>("/ingest", { method: "POST" }),
  metrics: () => request<MetricsSummary>("/metrics/summary"),
  listScans: () => request<{ scans: ScanRun[] }>("/scans"),
  getScan: (id: string) =>
    request<{ scan: ScanRun; findings: FindingSummary[] }>(`/scans/${id}`),
  getFinding: (scanId: string, findingId: string) =>
    request<{ finding: FindingDetail }>(`/scans/${scanId}/findings/${encodeURIComponent(findingId)}`),
  startScan: (body: StartScanRequest) =>
    request<{ scan: ScanRun }>("/scans", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelScan: (id: string) =>
    request<{ ok: boolean }>(`/scans/${id}/cancel`, { method: "POST" }),
  compare: (body: CompareRequest) =>
    request<CompareResult>("/compare", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listFs: (path?: string) =>
    request<FsListResponse>(
      `/fs/list${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    ),
};
