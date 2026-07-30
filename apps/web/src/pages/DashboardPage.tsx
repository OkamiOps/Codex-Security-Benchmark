import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  Analytics01Icon,
  ArrowRight01Icon,
  Bug01Icon,
  DollarCircleIcon,
  FireIcon,
  PlusSignIcon,
  RefreshIcon,
  Shield01Icon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";
import type { MetricsSummary, ScanRun } from "@csb/shared";
import { api } from "../api";
import {
  AlertBanner,
  EmptyState,
  LiveDuration,
  PageHeader,
  StatusBadge,
  Surface,
  cx,
} from "../components/ui";
import { formatDate, formatDuration, formatTokens, formatUsd } from "../format";

type CostTrendPoint = NonNullable<MetricsSummary["costTrend"]>[number];

function enrichMetrics(raw: MetricsSummary): MetricsSummary {
  const recent = raw.recent ?? [];
  const runningScans =
    raw.runningScans ?? recent.filter((s) => s.status === "running").length;
  const avgUsdPerScan =
    raw.avgUsdPerScan ??
    (raw.totalScans > 0 ? raw.totalEstimatedUsd / raw.totalScans : 0);
  const durations = recent
    .map((s) => s.durationMs)
    .filter((d): d is number => d != null && d > 0);
  const avgDurationMs =
    raw.avgDurationMs ??
    (durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null);
  const totalInputTokens =
    raw.totalInputTokens ??
    recent.reduce((a, s) => a + (s.cost?.inputTokens ?? 0), 0);
  const totalOutputTokens =
    raw.totalOutputTokens ??
    recent.reduce((a, s) => a + (s.cost?.outputTokens ?? 0), 0);
  const findingsHigh = raw.severity.critical + raw.severity.high;
  const highPerDollar =
    raw.highPerDollar ??
    (raw.totalEstimatedUsd > 0 ? findingsHigh / raw.totalEstimatedUsd : null);
  const findingsPerDollar =
    raw.findingsPerDollar ??
    (raw.totalEstimatedUsd > 0 ? raw.severity.total / raw.totalEstimatedUsd : null);
  const costTrend =
    raw.costTrend ??
    [...recent]
      .filter((r) => r.startedAt)
      .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
      .map((r) => ({
        scanId: r.id,
        displayName: r.displayName,
        startedAt: r.startedAt,
        estimatedUsd: r.cost?.estimatedUsd ?? 0,
        findingsHigh: r.severity.high + r.severity.critical,
        findingsTotal: r.severity.total,
        model: r.model,
        effort: r.effort,
      }));

  return {
    ...raw,
    runningScans,
    avgUsdPerScan,
    avgDurationMs,
    totalInputTokens,
    totalOutputTokens,
    highPerDollar,
    findingsPerDollar,
    costTrend,
    topCategories: raw.topCategories ?? [],
    byModelEffort: raw.byModelEffort ?? [],
  };
}

export function DashboardPage() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError(null);
      setData(enrichMetrics(await api.metrics()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
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

  const activeList = useMemo(
    () => data?.recent.filter((s) => s.status === "running") ?? [],
    [data],
  );
  const best = data?.byModelEffort[0] ?? null;
  const worst = data?.byModelEffort.at(-1) ?? null;
  const highPlus = data ? data.severity.critical + data.severity.high : 0;
  const maxTrendUsd = Math.max(1, ...(data?.costTrend.map((r) => r.estimatedUsd) ?? [1]));
  const maxTrendFind = Math.max(1, ...(data?.costTrend.map((r) => r.findingsTotal) ?? [1]));
  const maxCat = Math.max(1, ...(data?.topCategories.map((c) => c.count) ?? [1]));
  const maxHighPer = Math.max(
    0.001,
    ...(data?.byModelEffort.map((r) => r.highPerDollar ?? 0) ?? [0.001]),
  );
  const usdPerFinding =
    data && data.severity.total > 0
      ? data.totalEstimatedUsd / data.severity.total
      : null;
  const compareIds = data?.recent.filter((s) => s.status === "completed").slice(0, 2) ?? [];

  if (!data && !error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Quanto custou, o que achou e qual modelo×effort rende mais high por dólar."
        actions={
          <>
            <button
              className="btn btn-ghost btn-sm gap-2"
              type="button"
              onClick={() => void reindex()}
              disabled={busy}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={15}
                className={busy ? "animate-spin" : undefined}
              />
              Reindexar
            </button>
            {compareIds.length >= 2 && (
              <Link to="/compare" className="btn btn-ghost btn-sm gap-2">
                <HugeiconsIcon icon={Analytics01Icon} size={15} />
                Comparar
              </Link>
            )}
            <Link to="/scans/new" className="btn btn-primary btn-sm gap-2">
              <HugeiconsIcon icon={PlusSignIcon} size={15} />
              Novo scan
            </Link>
          </>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      {data && (
        <div className="space-y-4">
          {/* KPI row — 4 strong cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroKpi
              label="Gasto total"
              value={formatUsd(data.totalEstimatedUsd)}
              meta={`${data.completedScans}/${data.totalScans} scans · avg ${formatUsd(data.avgUsdPerScan)}`}
              tone="primary"
              icon={DollarCircleIcon}
              bar={Math.min(100, (data.totalEstimatedUsd / Math.max(data.avgUsdPerScan * 3, 1)) * 40)}
            />
            <HeroKpi
              label="Findings"
              value={String(data.severity.total)}
              meta={
                <span>
                  <span className="font-semibold text-error">{highPlus} high+</span>
                  {" · "}
                  {usdPerFinding != null ? `${formatUsd(usdPerFinding)}/finding` : "—"}
                </span>
              }
              tone="error"
              icon={Bug01Icon}
              bar={data.severity.total ? (highPlus / data.severity.total) * 100 : 0}
            />
            <HeroKpi
              label="High / $"
              value={data.highPerDollar?.toFixed(3) ?? "—"}
              meta={
                best
                  ? `melhor: ${best.model.split("/").pop()} · ${best.effort}`
                  : "rode scans para rankear"
              }
              tone="warning"
              icon={FireIcon}
              bar={
                data.highPerDollar != null
                  ? Math.min(100, (data.highPerDollar / maxHighPer) * 100)
                  : 0
              }
            />
            <HeroKpi
              label="Duração média"
              value={formatDuration(data.avgDurationMs)}
              meta={`${formatTokens(data.totalInputTokens)} tok in · ${formatTokens(data.totalOutputTokens)} out`}
              tone="info"
              icon={Timer01Icon}
              bar={
                data.avgDurationMs
                  ? Math.min(100, (data.avgDurationMs / (60 * 60 * 1000)) * 100)
                  : 0
              }
            />
          </div>

          {/* Live strip */}
          {activeList.length > 0 && (
            <div className="space-y-2">
              {activeList.map((active) => (
                <Link
                  key={active.id}
                  to={`/scans/${active.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-box border border-primary/40 bg-primary/10 px-4 py-3 ring-1 ring-primary/20 transition hover:bg-primary/15"
                >
                  <span className="live-dot text-primary" />
                  <StatusBadge status="running" />
                  <span className="font-display font-semibold">{active.displayName}</span>
                  <span className="font-mono text-xs text-base-content/60">
                    {active.model}/{active.effort}
                  </span>
                  <span className="ml-auto flex items-center gap-4 font-mono text-sm">
                    <LiveDuration
                      startedAt={active.startedAt}
                      status={active.status}
                      durationMs={active.durationMs}
                      className="font-semibold"
                    />
                    <span className="font-semibold text-primary">
                      {formatUsd(active.cost?.estimatedUsd)}
                    </span>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-12">
            {/* Cost × findings chart */}
            <section className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5 xl:col-span-7">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold">
                    Custo × findings por run
                  </h2>
                  <p className="text-xs text-base-content/55">
                    Passe o mouse nas barras · clique para abrir o scan
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-base-content/70">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Custo
                  </span>
                  <span className="flex items-center gap-1.5 text-base-content/70">
                    <span className="h-2.5 w-2.5 rounded-sm bg-secondary" /> Findings
                  </span>
                </div>
              </div>

              {data.costTrend.length === 0 ? (
                <p className="py-8 text-center text-sm text-base-content/50">Sem runs ainda.</p>
              ) : (
                <CostTrendChart
                  points={data.costTrend}
                  maxUsd={maxTrendUsd}
                  maxFindings={maxTrendFind}
                />
              )}

              {best && worst && best !== worst && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Insight
                    tone="success"
                    title="Melhor eficiência"
                    body={`${best.model} · ${best.effort} → ${best.highPerDollar?.toFixed(3) ?? "—"} high/$ (${formatUsd(best.avgUsd)} avg)`}
                  />
                  <Insight
                    tone="warning"
                    title="Pior high/$"
                    body={`${worst.model} · ${worst.effort} → ${worst.highPerDollar?.toFixed(3) ?? "—"} high/$ (${formatUsd(worst.avgUsd)} avg)`}
                  />
                </div>
              )}
            </section>

            {/* Risk mix */}
            <section className="rounded-box border border-base-300 bg-base-100 p-4 sm:p-5 xl:col-span-5">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold">Mix de risco</h2>
                  <p className="text-xs text-base-content/55">
                    {data.severity.total} findings indexados
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-semibold tabular-nums text-error">
                    {highPlus}
                  </div>
                  <div className="text-[11px] text-base-content/50">high+</div>
                </div>
              </div>

              <div className="space-y-3.5">
                <RiskBar
                  label="Critical"
                  n={data.severity.critical}
                  total={data.severity.total}
                  className="bg-error"
                  textClass="text-error"
                />
                <RiskBar
                  label="High"
                  n={data.severity.high}
                  total={data.severity.total}
                  className="bg-error/75"
                  textClass="text-error"
                />
                <RiskBar
                  label="Medium"
                  n={data.severity.medium}
                  total={data.severity.total}
                  className="bg-warning"
                  textClass="text-warning"
                />
                <RiskBar
                  label="Low"
                  n={data.severity.low}
                  total={data.severity.total}
                  className="bg-info"
                  textClass="text-info"
                />
              </div>

              {activeList.length === 0 && (
                <div className="mt-5 rounded-xl border border-dashed border-base-300 bg-base-200/40 px-3 py-3">
                  <div className="flex items-center gap-2 text-xs text-base-content/55">
                    <HugeiconsIcon icon={Activity01Icon} size={14} />
                    Nenhum scan ativo
                  </div>
                  <Link to="/scans/new" className="btn btn-primary btn-sm mt-2 w-full gap-1">
                    Iniciar scan
                    <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                  </Link>
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            {/* Efficiency ranking */}
            <Surface
              title="Ranking modelo × effort"
              action={<span className="badge badge-primary badge-sm">por high/$</span>}
              className="xl:col-span-7"
            >
              {data.byModelEffort.length === 0 ? (
                <EmptyState
                  title="Sem dados ainda"
                  description="Rode scans com modelos/effort diferentes."
                  icon={Analytics01Icon}
                />
              ) : (
                <div className="divide-y divide-base-300/60">
                  {data.byModelEffort.map((row, i) => (
                    <div
                      key={`${row.model}-${row.effort}`}
                      className={cx(
                        "px-4 py-3.5 transition hover:bg-base-200/45 sm:px-5",
                        i === 0 && "bg-primary/6",
                      )}
                      title={`${row.model} / ${row.effort}: ${row.highPerDollar?.toFixed(3) ?? "—"} high/$ · ${row.runs} runs · avg ${formatUsd(row.avgUsd)}`}
                    >
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cx(
                              "flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold",
                              i === 0
                                ? "bg-primary text-primary-content"
                                : "bg-base-200 text-base-content/60",
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm font-semibold">{row.model}</span>
                          <span className="rounded-md border border-base-300 bg-base-200 px-1.5 py-0.5 font-mono text-[10px]">
                            {row.effort}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={cx(
                              "font-mono text-sm font-semibold tabular-nums",
                              i === 0 ? "text-primary" : "text-base-content",
                            )}
                          >
                            {row.highPerDollar?.toFixed(3) ?? "—"}
                          </span>
                          <span className="ml-1 text-[11px] text-base-content/45">high/$</span>
                        </div>
                      </div>
                      <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-base-200">
                        <div
                          className={cx(
                            "h-full rounded-full transition",
                            i === 0 ? "bg-primary" : "bg-secondary/70",
                          )}
                          style={{
                            width: `${Math.max(4, ((row.highPerDollar ?? 0) / maxHighPer) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-base-content/55">
                        <span>{row.runs} run(s)</span>
                        <span>avg {formatUsd(row.avgUsd)}</span>
                        <span className="text-error">{row.findingsHigh} high+</span>
                        <span>{row.findingsTotal} total</span>
                        <span>{row.totalPerDollar?.toFixed(2) ?? "—"} find/$</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>

            {/* Categories */}
            <Surface
              title="Top categorias"
              action={
                <span className="badge badge-ghost badge-sm">
                  {data.topCategories.length} tipos
                </span>
              }
              className="xl:col-span-5"
            >
              {data.topCategories.length === 0 ? (
                <EmptyState
                  title="Sem categorias"
                  description="Findings com taxonomy aparecem aqui."
                  icon={Bug01Icon}
                />
              ) : (
                <div className="space-y-1 p-3 sm:p-4">
                  {data.topCategories.map((c) => {
                    const highPct = c.count > 0 ? (c.high / c.count) * 100 : 0;
                    return (
                      <div
                        key={c.category}
                        className="group rounded-lg px-2 py-2 transition hover:bg-base-200/60"
                        title={`${c.category}: ${c.count} findings · ${c.high} high+ (${Math.round(highPct)}%)`}
                      >
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{c.category}</span>
                          <span className="shrink-0 font-mono text-xs">
                            <span className="font-semibold">{c.count}</span>
                            {c.high > 0 && (
                              <span className="ml-1.5 text-error">{c.high}h</span>
                            )}
                          </span>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-base-200">
                          <div
                            className="h-full bg-error/80 transition group-hover:brightness-110"
                            style={{
                              width: `${Math.max(0, (c.high / maxCat) * 100)}%`,
                            }}
                          />
                          <div
                            className="h-full bg-secondary transition group-hover:brightness-110"
                            style={{
                              width: `${Math.max(0, ((c.count - c.high) / maxCat) * 100)}%`,
                            }}
                          />
                        </div>
                        {highPct >= 50 && (
                          <div className="mt-0.5 text-[11px] font-medium text-error">
                            {Math.round(highPct)}% high+
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Surface>
          </div>

          {/* Recent */}
          <Surface
            title="Runs recentes"
            action={
              <Link to="/scans" className="btn btn-ghost btn-xs gap-1">
                Ver todos
                <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
              </Link>
            }
          >
            {data.recent.length === 0 ? (
              <EmptyState
                title="Nenhum run"
                description="Inicie um scan para popular o dashboard."
                icon={Shield01Icon}
                action={
                  <Link to="/scans/new" className="btn btn-primary btn-sm">
                    Novo scan
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-base-300/60">
                {data.recent.map((s) => (
                  <RecentRow key={s.id} scan={s} />
                ))}
              </ul>
            )}
          </Surface>
        </div>
      )}
    </div>
  );
}

function HeroKpi({
  label,
  value,
  meta,
  tone,
  icon,
  bar,
}: {
  label: string;
  value: string;
  meta: ReactNode;
  tone: "primary" | "error" | "warning" | "info";
  icon: typeof DollarCircleIcon;
  bar: number;
}) {
  const chip =
    tone === "primary"
      ? "bg-primary/15 text-primary"
      : tone === "error"
        ? "bg-error/15 text-error"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-info/15 text-info";
  const fill =
    tone === "primary"
      ? "bg-primary"
      : tone === "error"
        ? "bg-error"
        : tone === "warning"
          ? "bg-warning"
          : "bg-info";
  const valueTone =
    tone === "primary"
      ? "text-primary"
      : tone === "error"
        ? "text-error"
        : tone === "warning"
          ? "text-warning"
          : "text-info";

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-base-content/50">
          {label}
        </span>
        <span className={cx("rounded-lg p-1.5", chip)}>
          <HugeiconsIcon icon={icon} size={15} />
        </span>
      </div>
      <div className={cx("font-display text-3xl font-semibold tabular-nums", valueTone)}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-base-content/55">{meta}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-base-200">
        <div className={cx("h-full rounded-full", fill)} style={{ width: `${Math.max(4, bar)}%` }} />
      </div>
    </div>
  );
}

function CostTrendChart({
  points,
  maxUsd,
  maxFindings,
}: {
  points: CostTrendPoint[];
  maxUsd: number;
  maxFindings: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover != null ? points[hover] : null;

  return (
    <div className="relative">
      {active && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-fit max-w-full px-2">
          <div className="rounded-xl border border-base-300 bg-base-100 px-3.5 py-2.5 shadow-lg ring-1 ring-base-content/5">
            <div className="truncate text-sm font-semibold">{active.displayName}</div>
            <div className="mt-0.5 font-mono text-[11px] text-base-content/55">
              {(active.model ?? "—").split("/").pop()}/{active.effort ?? "—"}
              {active.startedAt ? ` · ${formatDate(active.startedAt)}` : ""}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] text-base-content/50">Custo</div>
                <div className="font-mono text-sm font-semibold text-primary">
                  {formatUsd(active.estimatedUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-base-content/50">Findings</div>
                <div className="font-mono text-sm font-semibold text-secondary">
                  {active.findingsTotal}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-base-content/50">High+</div>
                <div className="font-mono text-sm font-semibold text-error">
                  {active.findingsHigh}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex h-52 items-end gap-2 border-b border-base-300/80 pt-16 sm:gap-3"
        onMouseLeave={() => setHover(null)}
      >
        {points.map((r, i) => {
          const usdH = Math.max(8, (r.estimatedUsd / maxUsd) * 100);
          const findH = Math.max(8, (r.findingsTotal / maxFindings) * 100);
          const on = hover === i;
          return (
            <Link
              key={r.scanId}
              to={`/scans/${r.scanId}`}
              className={cx(
                "group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-lg px-0.5 pb-1 transition",
                on ? "bg-base-200/70" : "hover:bg-base-200/40",
              )}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <div className="flex h-36 w-full items-end justify-center gap-1">
                <div
                  className={cx(
                    "w-[40%] rounded-t-md bg-primary transition duration-150",
                    on ? "opacity-100 brightness-110" : "opacity-85 group-hover:opacity-100",
                  )}
                  style={{ height: `${usdH}%` }}
                />
                <div
                  className={cx(
                    "w-[40%] rounded-t-md bg-secondary transition duration-150",
                    on ? "opacity-100 brightness-110" : "opacity-85 group-hover:opacity-100",
                  )}
                  style={{ height: `${findH}%` }}
                />
              </div>
              <div
                className={cx(
                  "w-full truncate text-center text-[11px] font-medium",
                  on ? "text-base-content" : "text-base-content/65",
                )}
              >
                {r.displayName}
              </div>
              <div className="font-mono text-[10px] text-base-content/45">
                {formatUsd(r.estimatedUsd)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RiskBar({
  label,
  n,
  total,
  className,
  textClass,
}: {
  label: string;
  n: number;
  total: number;
  className: string;
  textClass: string;
}) {
  const pct = total > 0 ? (n / total) * 100 : 0;
  return (
    <div
      className="group rounded-lg px-1 py-0.5 transition hover:bg-base-200/50"
      title={`${label}: ${n} (${pct.toFixed(1)}% do total)`}
    >
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className={cx("font-medium", textClass)}>{label}</span>
        <span className="font-mono text-xs tabular-nums">
          <span className="font-semibold">{n}</span>
          <span className="ml-1.5 text-base-content/45">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-base-200">
        <div
          className={cx(
            "h-full rounded-full transition-all duration-200 group-hover:brightness-110",
            className,
          )}
          style={{ width: `${Math.max(n > 0 ? 4 : 0, pct)}%` }}
        />
      </div>
    </div>
  );
}

function Insight({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "success" | "warning";
}) {
  return (
    <div
      className={cx(
        "rounded-xl border px-3 py-2.5",
        tone === "success" && "border-success/30 bg-success/10",
        tone === "warning" && "border-warning/30 bg-warning/10",
      )}
    >
      <div
        className={cx(
          "text-[10px] font-semibold uppercase tracking-wide",
          tone === "success" ? "text-success" : "text-warning",
        )}
      >
        {title}
      </div>
      <p className="mt-0.5 font-mono text-[11px] leading-snug text-base-content/80">{body}</p>
    </div>
  );
}

function RecentRow({ scan: s }: { scan: ScanRun }) {
  const highPlus = s.severity.high + s.severity.critical;
  return (
    <li>
      <Link
        to={`/scans/${s.id}`}
        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-base-200/55 sm:px-5"
      >
        <div className="flex h-10 w-1.5 shrink-0 flex-col overflow-hidden rounded-full bg-base-200">
          {highPlus > 0 && (
            <span className="bg-error" style={{ flexGrow: highPlus, minHeight: 3 }} />
          )}
          {s.severity.medium > 0 && (
            <span className="bg-warning" style={{ flexGrow: s.severity.medium, minHeight: 3 }} />
          )}
          {s.severity.low > 0 && (
            <span className="bg-info" style={{ flexGrow: s.severity.low, minHeight: 3 }} />
          )}
          {s.severity.total === 0 && <span className="flex-1 bg-base-content/15" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{s.displayName}</span>
            <StatusBadge status={s.status} />
            <span className="rounded border border-base-300 bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-base-content/65">
              {s.model}/{s.effort}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[11px] text-base-content/50">
            <span>{formatDate(s.startedAt)}</span>
            <span>·</span>
            <span>{s.severity.total} findings</span>
            {highPlus > 0 && <span className="text-error">{highPlus} high+</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-primary">
            {formatUsd(s.cost?.estimatedUsd)}
          </div>
          <LiveDuration
            startedAt={s.startedAt}
            completedAt={s.completedAt}
            status={s.status}
            durationMs={s.durationMs}
            className="text-[11px] text-base-content/50"
          />
        </div>
      </Link>
    </li>
  );
}
