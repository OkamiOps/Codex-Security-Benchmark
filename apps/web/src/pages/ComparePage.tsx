import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ChartHistogramIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { CompareResult, ScanRun } from "@csb/shared";
import { api } from "../api";
import {
  AlertBanner,
  EmptyState,
  LiveDuration,
  PageHeader,
  SeverityBadge,
  Surface,
} from "../components/ui";
import { formatUsd, shortId } from "../format";

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .listScans()
      .then((r) => {
        const completed = r.scans.filter((s) => s.status === "completed");
        setScans(completed);
        const fromQuery = (searchParams.get("ids") ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (fromQuery.length >= 2) {
          const allowed = new Set(completed.map((s) => s.id));
          setSelected(fromQuery.filter((id) => allowed.has(id)).slice(0, 6));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao listar"),
      );
  }, [searchParams]);

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
      <PageHeader
        title="Comparar"
        description="Selecione 2+ runs (idealmente do mesmo target) para ranking custo/benefício e diff de findings. High/$ é heurística — não verdade absoluta."
        actions={
          <button
            className="btn btn-primary gap-2"
            type="button"
            disabled={busy || selected.length < 2}
            onClick={() => void runCompare()}
          >
            {busy ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <HugeiconsIcon icon={Analytics01Icon} size={16} />
            )}
            {busy ? "Comparando…" : `Comparar (${selected.length})`}
          </button>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <Surface title="Runs completos" className="mb-6">
        {scans.length === 0 ? (
          <EmptyState
            title="Nenhum scan completo"
            description="Conclua pelo menos dois scans para comparar."
            icon={ChartHistogramIcon}
          />
        ) : (
          <div className="divide-y divide-base-300/60">
            {scans.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-primary/5 ${
                    checked ? "bg-primary/10" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mt-1"
                    checked={checked}
                    onChange={() => toggle(s.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.displayName}</span>
                      <span className="badge badge-ghost badge-sm font-mono">
                        {s.model}/{s.effort}
                      </span>
                      {checked && (
                        <span className="badge badge-primary badge-sm gap-1">
                          <HugeiconsIcon icon={Tick02Icon} size={12} />
                          selecionado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-base-content/60">
                      {formatUsd(s.cost?.estimatedUsd)} · {s.severity.total} findings ·{" "}
                      <span className="font-mono text-xs">{shortId(s.id)}</span>
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Surface>

      {result && (
        <div className="space-y-6">
          <Surface
            title="Ranking (high findings / $)"
            action={<span className="badge badge-primary badge-sm">melhor no topo</span>}
          >
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Target</th>
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
                  {result.ranking.map((row, i) => {
                    const scan = result.scans.find((s) => s.id === row.scanId);
                    return (
                    <tr key={row.scanId} className="hover">
                      <td className={i === 0 ? "font-bold text-primary" : ""}>{i + 1}</td>
                      <td>
                        <div className="font-medium">{scan?.displayName ?? shortId(row.scanId)}</div>
                        <div className="font-mono text-[10px] text-base-content/40">
                          {shortId(row.scanId)}
                        </div>
                      </td>
                      <td className="font-mono text-sm">{row.model ?? "—"}</td>
                      <td className="font-mono text-sm">{row.effort ?? "—"}</td>
                      <td>{formatUsd(row.estimatedUsd)}</td>
                      <td>{row.findingsHigh}</td>
                      <td>{row.findingsTotal}</td>
                      <td className="font-mono text-sm">
                        {row.highPerDollar == null ? "—" : row.highPerDollar.toFixed(3)}
                      </td>
                      <td className="font-mono text-sm">
                        {row.totalPerDollar == null ? "—" : row.totalPerDollar.toFixed(3)}
                      </td>
                      <td>
                        <LiveDuration
                          startedAt={scan?.startedAt}
                          completedAt={scan?.completedAt}
                          status={scan?.status}
                          durationMs={row.durationMs}
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface title={`Findings compartilhados (${result.shared.length})`}>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Severidade</th>
                    <th>Título</th>
                  </tr>
                </thead>
                <tbody>
                  {result.shared.slice(0, 50).map((f) => (
                    <tr key={f.key}>
                      <td>
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td>{f.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.scans.map((s) => (
              <Surface
                key={s.id}
                title={`${s.displayName} · ${s.model}/${s.effort}`}
                action={
                  <span className="badge badge-ghost badge-sm">
                    {result.uniqueByScan[s.id]?.length ?? 0} únicos
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Severidade</th>
                        <th>Título</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.uniqueByScan[s.id] ?? []).slice(0, 30).map((f) => (
                        <tr key={f.key}>
                          <td>
                            <SeverityBadge severity={f.severity} />
                          </td>
                          <td>{f.title}</td>
                        </tr>
                      ))}
                      {(result.uniqueByScan[s.id] ?? []).length === 0 && (
                        <tr>
                          <td colSpan={2} className="text-base-content/50">
                            Sem findings únicos neste run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Surface>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
