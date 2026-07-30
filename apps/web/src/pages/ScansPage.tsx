import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ScanRun } from "@csb/shared";
import { api } from "../api";
import { formatDate, formatDuration, formatUsd } from "../format";

export function ScansPage() {
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .listScans()
      .then((r) => setScans(r.scans))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao listar"),
      );
  }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Scans</h1>
        <p>Histórico indexado do state do Codex Security e runs iniciados por aqui.</p>
      </div>

      <div className="toolbar">
        <Link className="btn primary" to="/scans/new">
          Novo scan
        </Link>
        <Link className="btn" to="/compare">
          Comparar
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Modelo</th>
              <th>Effort</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Custo</th>
              <th>H / M / L</th>
              <th>Duração</th>
              <th>Início</th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 && (
              <tr>
                <td colSpan={9}>Nenhum scan encontrado.</td>
              </tr>
            )}
            {scans.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/scans/${s.id}`}>{s.displayName}</Link>
                  <div className="finding-meta">{s.repositoryPath ?? s.scanDir}</div>
                </td>
                <td className="mono">{s.model ?? "—"}</td>
                <td className="mono">{s.effort ?? "—"}</td>
                <td className="mono">{s.mode ?? "—"}</td>
                <td className={`status ${s.status}`}>{s.status}</td>
                <td>{formatUsd(s.cost?.estimatedUsd)}</td>
                <td className="mono">
                  {s.severity.high}/{s.severity.medium}/{s.severity.low}
                </td>
                <td>{formatDuration(s.durationMs)}</td>
                <td>{formatDate(s.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
