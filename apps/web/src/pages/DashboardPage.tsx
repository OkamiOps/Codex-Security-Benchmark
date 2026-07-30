import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MetricsSummary } from "@csb/shared";
import { api } from "../api";
import { formatDate, formatDuration, formatUsd } from "../format";

export function DashboardPage() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(await api.metrics());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reindex() {
    setBusy(true);
    try {
      await api.ingest();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao indexar");
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="empty">Carregando…</p>;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>
          Visão do gasto estimado, findings e eficiência por modelo e effort.
          Os custos vêm do Codex Security (estimativa de tokens API).
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <Link className="btn primary" to="/scans/new">
          Novo scan
        </Link>
        <button className="btn" type="button" onClick={() => void reindex()} disabled={busy}>
          {busy ? "Indexando…" : "Reindexar state"}
        </button>
      </div>

      {data && (
        <>
          <div className="hero-metrics">
            <div>
              <span className="metric-label">Gasto total</span>
              <div className="metric-value accent">{formatUsd(data.totalEstimatedUsd)}</div>
            </div>
            <div>
              <span className="metric-label">Scans</span>
              <div className="metric-value">
                {data.completedScans}/{data.totalScans}
              </div>
            </div>
            <div>
              <span className="metric-label">Findings</span>
              <div className="metric-value">{data.severity.total}</div>
            </div>
            <div>
              <span className="metric-label">High+</span>
              <div className="metric-value">
                {data.severity.critical + data.severity.high}
              </div>
            </div>
          </div>

          <h2 className="section-title">Ranking modelo × effort</h2>
          <div className="table-wrap" style={{ marginBottom: "2.5rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Effort</th>
                  <th>Runs</th>
                  <th>Custo</th>
                  <th>High+</th>
                  <th>High / $</th>
                  <th>Total / $</th>
                </tr>
              </thead>
              <tbody>
                {data.byModelEffort.length === 0 && (
                  <tr>
                    <td colSpan={7}>Nenhum run indexado ainda.</td>
                  </tr>
                )}
                {data.byModelEffort.map((row, i) => (
                  <tr key={`${row.model}-${row.effort}`}>
                    <td className={i === 0 ? "rank-1 mono" : "mono"}>{row.model}</td>
                    <td className="mono">{row.effort}</td>
                    <td>{row.runs}</td>
                    <td>{formatUsd(row.totalUsd)}</td>
                    <td>{row.findingsHigh}</td>
                    <td className="mono">
                      {row.highPerDollar == null ? "—" : row.highPerDollar.toFixed(3)}
                    </td>
                    <td className="mono">
                      {row.totalPerDollar == null ? "—" : row.totalPerDollar.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">Runs recentes</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Modelo</th>
                  <th>Effort</th>
                  <th>Status</th>
                  <th>Custo</th>
                  <th>Findings</th>
                  <th>Duração</th>
                  <th>Início</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/scans/${s.id}`}>{s.displayName}</Link>
                    </td>
                    <td className="mono">{s.model ?? "—"}</td>
                    <td className="mono">{s.effort ?? "—"}</td>
                    <td className={`status ${s.status}`}>{s.status}</td>
                    <td>{formatUsd(s.cost?.estimatedUsd)}</td>
                    <td>
                      {s.severity.total}{" "}
                      <span className="sev high">({s.severity.high}h)</span>
                    </td>
                    <td>{formatDuration(s.durationMs)}</td>
                    <td>{formatDate(s.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
