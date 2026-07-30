import { useEffect, useState } from "react";
import type { CompareResult, ScanRun } from "@csb/shared";
import { api } from "../api";
import { formatDuration, formatUsd, shortId } from "../format";

export function ComparePage() {
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .listScans()
      .then((r) => setScans(r.scans.filter((s) => s.status === "completed")))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao listar"),
      );
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function runCompare() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.compare({ scanIds: selected }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na comparação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Comparar</h1>
        <p>
          Selecione 2+ runs (idealmente do mesmo target) para ver ranking custo/benefício e
          findings únicos vs compartilhados. High/$ é uma heurística — não é verdade absoluta.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="checkbox-list" style={{ marginBottom: "1.25rem" }}>
        {scans.length === 0 && <p className="empty">Nenhum scan completo para comparar.</p>}
        {scans.map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span>
              <strong>{s.displayName}</strong>{" "}
              <span className="mono">
                {s.model}/{s.effort}
              </span>{" "}
              · {formatUsd(s.cost?.estimatedUsd)} · {s.severity.total} findings ·{" "}
              <span className="mono">{shortId(s.id)}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="toolbar">
        <button
          className="btn primary"
          type="button"
          disabled={busy || selected.length < 2}
          onClick={() => void runCompare()}
        >
          {busy ? "Comparando…" : "Comparar selecionados"}
        </button>
      </div>

      {result && (
        <>
          <h2 className="section-title">Ranking (high findings / $)</h2>
          <div className="table-wrap" style={{ marginBottom: "2rem" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Modelo</th>
                  <th>Effort</th>
                  <th>Custo</th>
                  <th>High+</th>
                  <th>Total</th>
                  <th>High/$</th>
                  <th>Total/$</th>
                  <th>Duração</th>
                </tr>
              </thead>
              <tbody>
                {result.ranking.map((row, i) => (
                  <tr key={row.scanId}>
                    <td className={i === 0 ? "rank-1" : ""}>{i + 1}</td>
                    <td className="mono">{row.model ?? "—"}</td>
                    <td className="mono">{row.effort ?? "—"}</td>
                    <td>{formatUsd(row.estimatedUsd)}</td>
                    <td>{row.findingsHigh}</td>
                    <td>{row.findingsTotal}</td>
                    <td className="mono">
                      {row.highPerDollar == null ? "—" : row.highPerDollar.toFixed(3)}
                    </td>
                    <td className="mono">
                      {row.totalPerDollar == null ? "—" : row.totalPerDollar.toFixed(3)}
                    </td>
                    <td>{formatDuration(row.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">Findings compartilhados ({result.shared.length})</h2>
          <div className="table-wrap" style={{ marginBottom: "2rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                </tr>
              </thead>
              <tbody>
                {result.shared.slice(0, 50).map((f) => (
                  <tr key={f.key}>
                    <td className={`sev ${f.severity}`}>{f.severity}</td>
                    <td>{f.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title">Únicos por scan</h2>
          {result.scans.map((s) => (
            <div key={s.id} style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontFamily: "var(--font-display)", marginBottom: "0.5rem" }}>
                {s.displayName} · {s.model}/{s.effort} (
                {result.uniqueByScan[s.id]?.length ?? 0})
              </h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.uniqueByScan[s.id] ?? []).slice(0, 30).map((f) => (
                      <tr key={f.key}>
                        <td className={`sev ${f.severity}`}>{f.severity}</td>
                        <td>{f.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
