import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowLeft01Icon,
  Bug01Icon,
  Copy01Icon,
  DollarCircleIcon,
  File01Icon,
  Folder01Icon,
  GitBranchIcon,
  Search01Icon,
  StopIcon,
  Timer01Icon,
} from "@hugeicons/core-free-icons";
import type { FindingDetail, FindingSummary, ScanEvent, ScanRun } from "@csb/shared";
import { api } from "../api";
import { FindingInspector } from "../components/FindingInspector";
import {
  AlertBanner,
  EmptyState,
  LiveDuration,
  LevelPill,
  MetricCard,
  ScanProgressBar,
  SeverityBadge,
  SevRail,
  StatusBadge,
  Surface,
  cx,
} from "../components/ui";
import { formatDate, formatTokens, formatUsd, shortId } from "../format";

type Tab = "overview" | "findings" | "logs";

export function ScanDetailPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [findings, setFindings] = useState<FindingSummary[]>([]);
  const [selected, setSelected] = useState<FindingDetail | null>(null);
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function load() {
    const data = await api.getScan(id);
    setScan(data.scan);
    setFindings(data.findings);
    return data;
  }

  useEffect(() => {
    setTab("overview");
    setSelected(null);
    setSeverity("");
    setCategory("");
    setQ("");
    setLogs([]);
    void load()
      .then((data) => {
        if (searchParams.get("f")) setTab("findings");
        else if (data.scan.status === "running") setTab("logs");
        else if (data.findings.length > 0) setTab("findings");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao carregar"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!scan || scan.status !== "running") return;
    const es = new EventSource(`/api/scans/${id}/events`);
    const onAny = () => (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as ScanEvent;
        if (data.message) setLogs((prev) => [...prev.slice(-500), data.message!]);
        if (data.scan) setScan(data.scan);
        if (data.progress && !data.scan) {
          setScan((prev) => (prev ? { ...prev, progress: data.progress! } : prev));
        }
        if (data.type === "done") {
          void load();
          es.close();
        } else if (data.type === "error") {
          // Orphaned/restart cases used to emit a hard error — only close if
          // the scan actually left the running state.
          void load().then((d) => {
            if (d.scan.status !== "running") es.close();
          });
        }
      } catch {
        // ignore
      }
    };
    for (const t of ["log", "status", "cost", "progress", "done", "error"]) {
      es.addEventListener(t, onAny());
    }
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => {
      es.close();
      window.clearInterval(timer);
    };
  }, [id, scan?.status]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of findings) {
      const c = f.category ?? null;
      if (!c) continue;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [findings]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (severity && f.severity !== severity) return false;
      if (category && (f.category ?? "Uncategorized") !== category) return false;
      if (!q) return true;
      const cwe = f.cwe ?? [];
      const hay =
        `${f.title} ${f.primaryPath ?? ""} ${f.summary ?? ""} ${f.category ?? ""} ${cwe.join(" ")}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [findings, severity, category, q]);

  const severityCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, other: 0 };
    for (const f of findings) {
      if (f.severity in c) c[f.severity as keyof typeof c] += 1;
      else c.other += 1;
    }
    return c;
  }, [findings]);

  useEffect(() => {
    const fid = searchParams.get("f");
    if (!fid || !findings.length) return;
    if (selected?.findingId === fid) return;
    const hit = findings.find((f) => f.findingId === fid);
    if (hit) {
      setTab("findings");
      void openFinding(hit, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, searchParams]);

  async function openFinding(f: FindingSummary, pushUrl = true) {
    setTab("findings");
    try {
      const { finding } = await api.getFinding(id, f.findingId);
      setSelected(finding);
      if (pushUrl) setSearchParams({ f: f.findingId }, { replace: true });
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

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!scan && !error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  if (!scan) return <AlertBanner>{error}</AlertBanner>;

  const running = scan.status === "running";
  const highPlus = scan.severity.high + scan.severity.critical;
  const usd = scan.cost?.estimatedUsd ?? 0;
  const usdPerFinding =
    scan.cost && scan.severity.total > 0 ? usd / scan.severity.total : null;
  const highPerDollar = usd > 0 ? highPlus / usd : null;
  const maxCat = Math.max(1, ...categories.map(([, n]) => n), 1);
  const totalFindings = Math.max(1, findings.length);

  return (
    <div className="space-y-6">
      <section
        className={cx(
          "relative overflow-hidden rounded-box border bg-base-100",
          running ? "border-primary/40 ring-1 ring-primary/20" : "border-base-300",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

        <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link to="/scans" className="btn btn-ghost btn-sm gap-1.5">
                <HugeiconsIcon icon={ArrowLeft01Icon} size={15} />
                Scans
              </Link>
              <StatusBadge status={scan.status} />
              <span className="badge badge-ghost badge-sm font-mono">
                {scan.model}/{scan.effort}
              </span>
              {scan.mode && (
                <span className="badge badge-ghost badge-sm font-mono">{scan.mode}</span>
              )}
              <span className="badge badge-ghost badge-sm font-mono">{shortId(scan.id)}</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {scan.displayName}
            </h1>

            <button
              type="button"
              className="mt-2 max-w-full truncate font-mono text-sm text-base-content/55 hover:text-primary"
              onClick={() => void copyText(scan.repositoryPath ?? scan.scanDir)}
              title="Copiar path"
            >
              {scan.repositoryPath ?? scan.scanDir}
              {copied && <span className="ml-2 text-success">copiado</span>}
            </button>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/compare" className="btn btn-ghost btn-sm gap-1.5">
                <HugeiconsIcon icon={Analytics01Icon} size={15} />
                Comparar
              </Link>
              {running && (
                <button
                  className="btn btn-error btn-sm gap-1.5"
                  type="button"
                  onClick={() => void cancel()}
                >
                  <HugeiconsIcon icon={StopIcon} size={15} />
                  Cancelar scan
                </button>
              )}
            </div>

            {(running || scan.status === "completed") && scan.progress && (
              <ScanProgressBar
                progress={scan.progress}
                status={scan.status}
                className="mt-5 max-w-xl"
              />
            )}
          </div>
        </div>

        <div className="grid gap-3 border-t border-base-300 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:p-5">
          <MetricCard
            label={running ? "Decorrido" : "Duração"}
            icon={Timer01Icon}
            accent={running}
            value={
              <LiveDuration
                startedAt={scan.startedAt}
                completedAt={scan.completedAt}
                status={scan.status}
                durationMs={scan.durationMs}
                className="text-[1.85rem] font-bold tracking-tight"
              />
            }
            hint={
              running && scan.progress
                ? `${scan.progress.percent}% · ${scan.progress.phaseLabel}`
                : formatDate(scan.startedAt)
            }
          />
          <MetricCard
            label="Custo estimado"
            icon={DollarCircleIcon}
            accent
            value={formatUsd(usd)}
            hint={
              scan.cost
                ? `${formatTokens(scan.cost.inputTokens + scan.cost.outputTokens)} tokens`
                : "sem custo"
            }
          />
          <MetricCard
            label="Findings"
            icon={Bug01Icon}
            value={String(scan.severity.total)}
            hint={`${scan.severity.high} high · ${scan.severity.medium} med · ${scan.severity.low} low`}
          />
          <MetricCard
            label="High+"
            value={String(highPlus)}
            hint="critical + high"
          />
          <MetricCard
            label="High / $"
            value={highPerDollar != null ? highPerDollar.toFixed(2) : "—"}
            hint="eficiência"
          />
          <MetricCard
            label="$ / finding"
            value={usdPerFinding != null ? formatUsd(usdPerFinding) : "—"}
            hint="custo unitário"
          />
        </div>

        {(scan.cost?.inputTokens || 0) > 0 && (
          <div className="grid gap-px border-t border-base-300 bg-base-300 sm:grid-cols-4">
            <TokenCell label="Input" value={scan.cost!.inputTokens} />
            <TokenCell label="Cached" value={scan.cost!.cachedInputTokens} />
            <TokenCell label="Output" value={scan.cost!.outputTokens} />
            <TokenCell label="USD" value={scan.cost!.estimatedUsd} money />
          </div>
        )}
      </section>

      {error && <AlertBanner>{error}</AlertBanner>}

      <div
        role="tablist"
        className="inline-flex w-full gap-0.5 rounded-full bg-base-200 p-1 ring-1 ring-base-content/10 sm:w-fit"
      >
        {(
          [
            ["overview", "Visão geral"],
            ["findings", `Findings (${findings.length})`],
            ["logs", running ? "Logs ao vivo" : "Logs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={cx(
              "flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition sm:flex-none",
              tab === key
                ? "bg-base-content text-base-100 shadow-sm"
                : "text-base-content/55 hover:bg-base-content/5 hover:text-base-content/85",
            )}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "logs" && running && <span className="live-dot ml-2" />}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
          <Surface title="Severidade & categorias">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex h-3.5 overflow-hidden rounded-full bg-base-200">
                {severityCounts.critical > 0 && (
                  <span
                    className="bg-error"
                    style={{ width: `${(severityCounts.critical / totalFindings) * 100}%` }}
                  />
                )}
                {severityCounts.high > 0 && (
                  <span
                    className="bg-error/70"
                    style={{ width: `${(severityCounts.high / totalFindings) * 100}%` }}
                  />
                )}
                {severityCounts.medium > 0 && (
                  <span
                    className="bg-warning"
                    style={{ width: `${(severityCounts.medium / totalFindings) * 100}%` }}
                  />
                )}
                {severityCounts.low > 0 && (
                  <span
                    className="bg-info"
                    style={{ width: `${(severityCounts.low / totalFindings) * 100}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SevCount label="Critical" n={severityCounts.critical} tone="error" />
                <SevCount label="High" n={severityCounts.high} tone="error" />
                <SevCount label="Medium" n={severityCounts.medium} tone="warning" />
                <SevCount label="Low" n={severityCounts.low} tone="info" />
              </div>

              {categories.length > 0 && (
                <div>
                  <div className="mb-3 text-sm font-medium text-base-content/55">
                    Top categorias
                  </div>
                  <div className="space-y-2.5">
                    {categories.slice(0, 8).map(([cat, n]) => (
                      <button
                        key={cat}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-base-200/70"
                        onClick={() => {
                          setCategory(cat);
                          setTab("findings");
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {cat}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-base-content/50">
                          {n}
                        </span>
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-base-200">
                          <div
                            className="h-full bg-secondary"
                            style={{ width: `${Math.max(10, (n / maxCat) * 100)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {findings.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-base-content/55">
                      Top findings
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setTab("findings")}
                    >
                      Ver todos
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {findings.slice(0, 5).map((f) => (
                      <button
                        key={f.findingId}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-base-200/70"
                        onClick={() => void openFinding(f)}
                      >
                        <SeverityBadge severity={f.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{f.title}</p>
                          {f.category && (
                            <p className="mt-0.5 truncate text-xs text-primary/80">
                              {f.category}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Surface>

          <Surface title="Alvo">
            <div className="space-y-4 p-5 sm:p-6">
              <MetaRow
                icon={Folder01Icon}
                label="Repositório"
                value={scan.repositoryPath ?? "—"}
                onCopy={
                  scan.repositoryPath ? () => void copyText(scan.repositoryPath!) : undefined
                }
              />
              <MetaRow icon={GitBranchIcon} label="Revision" value={scan.revision ?? "—"} mono />
              <MetaRow
                icon={DollarCircleIcon}
                label="Modelo / effort"
                value={`${scan.model ?? "—"} / ${scan.effort ?? "—"}`}
                mono
              />
              <MetaRow
                icon={File01Icon}
                label="Output"
                value={scan.scanDir}
                mono
                onCopy={() => void copyText(scan.scanDir)}
              />
              <MetaRow label="Início" value={formatDate(scan.startedAt)} />
              <MetaRow label="Fim" value={formatDate(scan.completedAt)} />
              <MetaRow label="Source" value={scan.source} />
            </div>
          </Surface>
        </div>
      )}

      {tab === "findings" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-center">
            <label className="input input-bordered flex flex-1 items-center gap-2">
              <HugeiconsIcon icon={Search01Icon} size={16} className="opacity-50" />
              <input
                className="grow text-sm"
                placeholder="Buscar título, path, CWE, categoria…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["", "Todas"],
                ["critical", "Crit"],
                ["high", "High"],
                ["medium", "Med"],
                ["low", "Low"],
              ].map(([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  className={cx("btn btn-sm", severity === value ? "btn-primary" : "btn-ghost")}
                  onClick={() => setSeverity(value)}
                >
                  {label}
                  {value === "critical" && severityCounts.critical > 0
                    ? ` ${severityCounts.critical}`
                    : ""}
                  {value === "high" && severityCounts.high > 0
                    ? ` ${severityCounts.high}`
                    : ""}
                  {value === "medium" && severityCounts.medium > 0
                    ? ` ${severityCounts.medium}`
                    : ""}
                  {value === "low" && severityCounts.low > 0 ? ` ${severityCounts.low}` : ""}
                </button>
              ))}
            </div>
            {categories.length > 0 && (
              <select
                className="select select-bordered select-sm max-w-[16rem] font-mono text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas categorias</option>
                {categories.map(([c, n]) => (
                  <option key={c} value={c}>
                    {c} ({n})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid overflow-hidden rounded-box border border-base-300 bg-base-100 xl:grid-cols-[minmax(0,24rem)_1fr] 2xl:grid-cols-[minmax(0,28rem)_1fr]">
            <div className="max-h-[78vh] overflow-y-auto border-b border-base-300 xl:border-b-0 xl:border-r">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100/95 px-4 py-3 backdrop-blur">
                <span className="text-sm font-medium text-base-content/60">
                  {filtered.length}
                  {filtered.length !== findings.length ? ` / ${findings.length}` : ""}{" "}
                  findings
                </span>
                <HugeiconsIcon icon={Bug01Icon} size={15} className="text-base-content/35" />
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  title="Nenhum finding"
                  description={
                    running
                      ? "Ainda em andamento — veja os logs."
                      : "Nada corresponde aos filtros."
                  }
                  icon={Bug01Icon}
                />
              ) : (
                <div className="divide-y divide-base-300/50">
                  {filtered.map((f, idx) => (
                    <button
                      key={f.findingId}
                      type="button"
                      className={cx(
                        "flex w-full gap-3 px-3 py-3.5 text-left transition",
                        selected?.findingId === f.findingId
                          ? "bg-primary/12"
                          : "hover:bg-base-200/70",
                      )}
                      onClick={() => void openFinding(f)}
                    >
                      <SevRail severity={f.severity} />
                      <span className="w-6 shrink-0 pt-1 font-mono text-xs text-base-content/35">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={f.severity} />
                          {f.confidence && <LevelPill level={f.confidence} />}
                          {f.cwe?.[0] && (
                            <span className="rounded border border-secondary/35 bg-secondary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary">
                              {f.cwe[0]}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-base-content">
                          {f.title}
                        </p>
                        {f.category && (
                          <p className="mt-1 truncate text-sm text-primary/85">{f.category}</p>
                        )}
                        <p className="mt-1 truncate font-mono text-xs text-base-content/45">
                          {f.primaryPath ?? f.findingId}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-[78vh] overflow-hidden xl:sticky xl:top-16">
              <FindingInspector
                finding={selected}
                onClose={
                  selected
                    ? () => {
                        setSelected(null);
                        setSearchParams({}, { replace: true });
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <Surface
          title={
            <span className="flex items-center gap-2">
              Stream do CLI
              {running && <span className="loading loading-dots loading-xs text-primary" />}
            </span>
          }
          action={
            <span className="font-mono text-sm text-base-content/45">{logs.length} linhas</span>
          }
        >
          <pre
            ref={logRef}
            className="hud-frame max-h-[65vh] overflow-auto bg-[#0a0c10] p-5 font-mono text-xs leading-relaxed text-emerald-100/85"
          >
            {logs.length
              ? logs.join("\n")
              : running
                ? "Aguardando eventos… Se a API reiniciou no meio do scan, o stdout original se perde; progresso e atividade do workbench entram aqui."
                : "Sem logs capturados para este run (só runs iniciados pela UI emitem stream)."}
          </pre>
        </Surface>
      )}
    </div>
  );
}

function TokenCell({
  label,
  value,
  money,
}: {
  label: string;
  value: number;
  money?: boolean;
}) {
  return (
    <div className="bg-base-100 px-5 py-3.5">
      <div className="text-xs uppercase tracking-wide text-base-content/45">{label}</div>
      <div className="mt-0.5 font-mono text-base tabular-nums">
        {money ? formatUsd(value) : formatTokens(value)}
      </div>
    </div>
  );
}

function SevCount({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: "error" | "warning" | "info";
}) {
  const toneClass =
    tone === "error"
      ? "border-error/30 bg-error/10 text-error"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-info/30 bg-info/10 text-info";
  return (
    <div className={cx("rounded-xl border px-4 py-3.5", toneClass)}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{n}</div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  mono,
  onCopy,
}: {
  icon?: typeof Folder01Icon;
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl border border-base-300/70 bg-base-200/30 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm text-base-content/55">
          {icon && <HugeiconsIcon icon={icon} size={14} />}
          {label}
        </span>
        {onCopy && (
          <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={onCopy}>
            <HugeiconsIcon icon={Copy01Icon} size={13} />
            copiar
          </button>
        )}
      </div>
      <div className={cx("break-all text-sm leading-relaxed", mono && "font-mono text-[13px]")}>
        {value}
      </div>
    </div>
  );
}
