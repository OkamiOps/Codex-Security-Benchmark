import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { FindingDetail, FindingSummary, ScanEvent, ScanRun } from "@csb/shared";
import { api } from "../api";
import { formatDate, formatDuration, formatUsd } from "../format";

export function ScanDetailPage() {
  const { id = "" } = useParams();
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [findings, setFindings] = useState<FindingSummary[]>([]);
  const [selected, setSelected] = useState<FindingDetail | null>(null);
  const [severity, setSeverity] = useState("");
  const [q, setQ] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await api.getScan(id);
    setScan(data.scan);
    setFindings(data.findings);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Falha ao carregar"),
    );
  }, [id]);

  useEffect(() => {
    if (!scan || scan.status !== "running") return;
    const es = new EventSource(`/api/scans/${id}/events`);
    const onAny = (type: string) => (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as ScanEvent;
        if (data.message) {
          setLogs((prev) => [...prev.slice(-400), `[${type}] ${data.message}`]);
        }
        if (data.scan) setScan(data.scan);
        if (data.type === "done" || data.type === "error") {
          void load();
          es.close();
        }
      } catch {
        // ignore
      }
    };
    for (const t of ["log", "status", "cost", "done", "error"]) {
      es.addEventListener(t, onAny(t));
    }
    es.onerror = () => {
      // EventSource retries; also refresh periodically
    };
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 8000);
    return () => {
      es.close();
      window.clearInterval(timer);
    };
  }, [id, scan?.status]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severity && f.severity !== severity) return false;
      if (!q) return true;
      const hay = `${f.title} ${f.primaryPath ?? ""} ${f.summary ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [findings, severity, q]);

  async function openFinding(f: FindingSummary) {
    try {
      const { finding } = await api.getFinding(id, f.findingId);
      setSelected(finding);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao abrir finding");
    }
  }

  async function cancel() {
    try {
      await api.cancelScan(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar");
    }
  }

  if (!scan && !error) return <p className="empty">Carregando…</p>;
  if (!scan) return <p className="error">{error}</p>;

  return (
    <div>
      <div className="page-head">
        <h1>{scan.displayName}</h1>
        <p>
          <span className={`status ${scan.status}`}>{scan.status}</span>
          {" · "}
          <span className="mono">{scan.model ?? "—"}</span>
          {" / "}
          <span className="mono">{scan.effort ?? "—"}</span>
          {" · "}
          {formatUsd(scan.cost?.estimatedUsd)}
          {" · "}
          {formatDuration(scan.durationMs)}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <Link className="btn" to="/scans">
          Voltar
        </Link>
        <Link className="btn" to="/compare">
          Comparar
        </Link>
        {scan.status === "running" && (
          <button className="btn danger" type="button" onClick={() => void cancel()}>
            Cancelar
          </button>
        )}
      </div>

      <div className="hero-metrics">
        <div>
          <span className="metric-label">Custo</span>
          <div className="metric-value accent">{formatUsd(scan.cost?.estimatedUsd)}</div>
        </div>
        <div>
          <span className="metric-label">Findings</span>
          <div className="metric-value">{scan.severity.total}</div>
        </div>
        <div>
          <span className="metric-label">High / Med / Low</span>
          <div className="metric-value" style={{ fontSize: "1.5rem" }}>
            {scan.severity.high}/{scan.severity.medium}/{scan.severity.low}
          </div>
        </div>
        <div>
          <span className="metric-label">Início</span>
          <div className="metric-value" style={{ fontSize: "1.2rem" }}>
            {formatDate(scan.startedAt)}
          </div>
        </div>
      </div>

      <p className="finding-meta" style={{ marginBottom: "1.5rem" }}>
        Repo: {scan.repositoryPath ?? "—"}
        <br />
        Revision: {scan.revision ?? "—"}
        <br />
        Dir: {scan.scanDir}
      </p>

      {scan.status === "running" && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 className="section-title">Progresso</h2>
          <div className="log-box">{logs.join("\n") || "Aguardando eventos do CLI…"}</div>
        </div>
      )}

      <div className="toolbar">
        <input
          placeholder="Filtrar findings…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "0.55rem 0.75rem",
            minWidth: 220,
          }}
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "0.55rem 0.75rem",
          }}
        >
          <option value="">Todas severidades</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
          <option value="critical">critical</option>
        </select>
      </div>

      <div className="split">
        <div className="panel">
          <h2 className="section-title">Findings ({filtered.length})</h2>
          {filtered.length === 0 && <p className="empty">Nenhum finding.</p>}
          {filtered.map((f) => (
            <div
              key={f.findingId}
              className={`finding-row ${selected?.findingId === f.findingId ? "active" : ""}`}
              onClick={() => void openFinding(f)}
            >
              <div className={`sev ${f.severity}`}>{f.severity}</div>
              <div>
                <p className="finding-title">{f.title}</p>
                <div className="finding-meta">{f.primaryPath ?? f.ruleId ?? f.findingId}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="drawer">
          {!selected && <p className="empty">Selecione um finding para ver detalhes.</p>}
          {selected && (
            <>
              <div className={`sev ${selected.severity}`}>{selected.severity}</div>
              <h3>{selected.title}</h3>
              {selected.summary && <p>{selected.summary}</p>}
              {selected.primaryPath && (
                <p className="finding-meta">{selected.primaryPath}</p>
              )}
              {selected.remediation != null && (
                <>
                  <h4>Remediação</h4>
                  <pre>{JSON.stringify(selected.remediation, null, 2)}</pre>
                </>
              )}
              {Array.isArray(selected.codeEvidence) && selected.codeEvidence.length > 0 && (
                <>
                  <h4>Evidência</h4>
                  {(selected.codeEvidence as Array<Record<string, unknown>>)
                    .slice(0, 4)
                    .map((ev, i) => (
                      <div key={i} style={{ marginBottom: "0.75rem" }}>
                        <div className="finding-meta">
                          {String(ev.path ?? "")}
                          {ev.startLine != null ? `:${String(ev.startLine)}` : ""}
                          {ev.role ? ` · ${String(ev.role)}` : ""}
                        </div>
                        {typeof ev.code === "string" && (
                          <pre className="code-block">{ev.code}</pre>
                        )}
                      </div>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
