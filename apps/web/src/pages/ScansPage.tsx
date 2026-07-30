import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ArrowRight01Icon,
  Bug01Icon,
  DollarCircleIcon,
  GridViewIcon,
  LeftToRightListBulletIcon,
  PlusSignIcon,
  Search01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";
import type { ScanRun } from "@csb/shared";
import { api } from "../api";
import {
  AlertBanner,
  EmptyState,
  LiveDuration,
  PageHeader,
  ScanProgressBar,
  StatusBadge,
  cx,
} from "../components/ui";
import { formatDate, formatUsd, shortId } from "../format";

type SortKey = "recent" | "cost" | "findings" | "high";
type ViewMode = "grid" | "list";

const VIEW_KEY = "csb-scans-view";

export function ScansPage() {
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [effort, setEffort] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === "list" || v === "grid" ? v : "grid";
    } catch {
      return "grid";
    }
  });

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  async function load() {
    try {
      const r = await api.listScans();
      setScans(r.scans);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao listar");
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(id);
  }, []);

  const efforts = useMemo(() => {
    const set = new Set<string>();
    for (const s of scans) if (s.effort) set.add(s.effort);
    return [...set].sort();
  }, [scans]);

  const totals = useMemo(() => {
    let usd = 0;
    let findings = 0;
    let high = 0;
    let running = 0;
    for (const s of scans) {
      usd += s.cost?.estimatedUsd ?? 0;
      findings += s.severity.total;
      high += s.severity.critical + s.severity.high;
      if (s.status === "running") running += 1;
    }
    return { usd, findings, high, running, n: scans.length };
  }, [scans]);

  const filtered = useMemo(() => {
    const list = scans.filter((s) => {
      if (status && s.status !== status) return false;
      if (effort && s.effort !== effort) return false;
      if (!q) return true;
      const hay =
        `${s.displayName} ${s.model ?? ""} ${s.effort ?? ""} ${s.repositoryPath ?? ""} ${s.id}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

    const score = (s: ScanRun) => {
      if (sort === "cost") return s.cost?.estimatedUsd ?? 0;
      if (sort === "findings") return s.severity.total;
      if (sort === "high") return s.severity.critical + s.severity.high;
      return Date.parse(s.startedAt ?? "") || 0;
    };
    return [...list].sort((a, b) => score(b) - score(a));
  }, [scans, q, status, effort, sort]);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-4),
    );
  }

  const compareHref =
    selected.length >= 2
      ? `/compare?ids=${encodeURIComponent(selected.join(","))}`
      : "/compare";

  const maxUsd = Math.max(1, ...filtered.map((x) => x.cost?.estimatedUsd ?? 0));

  return (
    <div>
      <PageHeader
        title="Scans"
        description="Histórico de runs — custo, findings e eficiência."
        actions={
          <>
            <Link
              to={compareHref}
              className={cx(
                "btn btn-sm gap-2",
                selected.length >= 2 ? "btn-secondary" : "btn-ghost",
              )}
            >
              <HugeiconsIcon icon={Analytics01Icon} size={15} />
              Comparar{selected.length >= 2 ? ` (${selected.length})` : ""}
            </Link>
            <Link to="/scans/new" className="btn btn-primary btn-sm gap-2">
              <HugeiconsIcon icon={PlusSignIcon} size={15} />
              Novo scan
            </Link>
          </>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5">
          <span className="text-base-content/50">Runs </span>
          <span className="font-semibold tabular-nums">{totals.n}</span>
          {totals.running > 0 && (
            <span className="ml-1.5 text-primary">{totals.running} live</span>
          )}
        </span>
        <span className="rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5">
          <HugeiconsIcon icon={DollarCircleIcon} size={12} className="mr-1 inline text-primary" />
          <span className="font-mono font-semibold text-primary tabular-nums">
            {formatUsd(totals.usd)}
          </span>
        </span>
        <span className="rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5">
          <HugeiconsIcon icon={Bug01Icon} size={12} className="mr-1 inline text-error" />
          <span className="font-semibold tabular-nums">{totals.findings}</span>
          <span className="ml-1 font-semibold text-error">{totals.high}h+</span>
        </span>
        <span className="rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5 text-base-content/55">
          {filtered.length} visíveis
        </span>
      </div>

      <div className="mb-3 rounded-box border border-base-300 bg-base-100 p-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="input input-bordered input-sm flex min-w-0 flex-1 items-center gap-2">
            <HugeiconsIcon icon={Search01Icon} size={14} className="opacity-50" />
            <input
              className="grow text-sm"
              placeholder="Buscar target, modelo, path…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {[
              ["", "Todos"],
              ["running", "Rodando"],
              ["completed", "Concluído"],
              ["failed", "Falhou"],
              ["cancelled", "Cancelado"],
            ].map(([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                className={cx(
                  "btn btn-xs",
                  status === value ? "btn-primary" : "btn-ghost border border-base-300",
                )}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {efforts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {efforts.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={cx(
                    "btn btn-xs font-mono",
                    effort === e ? "btn-secondary" : "btn-ghost border border-base-300",
                  )}
                  onClick={() => setEffort(effort === e ? "" : e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <select
            className="select select-bordered select-sm w-full lg:w-36"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="recent">Recente</option>
            <option value="cost">Custo</option>
            <option value="findings">Findings</option>
            <option value="high">High+</option>
          </select>

          <div className="join border border-base-300">
            <button
              type="button"
              className={cx("btn join-item btn-sm btn-square", view === "grid" && "btn-primary")}
              onClick={() => changeView("grid")}
              title="Grade (2 colunas)"
              aria-label="Ver em grade"
            >
              <HugeiconsIcon icon={GridViewIcon} size={15} />
            </button>
            <button
              type="button"
              className={cx("btn join-item btn-sm btn-square", view === "list" && "btn-primary")}
              onClick={() => changeView("list")}
              title="Lista compacta"
              aria-label="Ver em lista"
            >
              <HugeiconsIcon icon={LeftToRightListBulletIcon} size={15} />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100">
          <EmptyState
            title="Nenhum scan encontrado"
            description="Ajuste os filtros ou inicie um novo scan."
            icon={Shield01Icon}
            action={
              <Link to="/scans/new" className="btn btn-primary btn-sm">
                Novo scan
              </Link>
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => (
            <ScanCard
              key={s.id}
              scan={s}
              checked={selected.includes(s.id)}
              onToggle={() => toggleSelect(s.id)}
              maxUsd={maxUsd}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          <div className="hidden border-b border-base-300 bg-base-200/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-base-content/45 sm:grid sm:grid-cols-[1.5rem_1fr_7rem_5.5rem_6.5rem_5.5rem_4.5rem] sm:gap-3">
            <span />
            <span>Target</span>
            <span className="text-right">Custo</span>
            <span className="text-right">Findings</span>
            <span>Severidade</span>
            <span className="text-right">Duração</span>
            <span />
          </div>
          <ul className="divide-y divide-base-300/60">
            {filtered.map((s) => (
              <ScanRow
                key={s.id}
                scan={s}
                checked={selected.includes(s.id)}
                onToggle={() => toggleSelect(s.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScanCard({
  scan: s,
  checked,
  onToggle,
  maxUsd,
}: {
  scan: ScanRun;
  checked: boolean;
  onToggle: () => void;
  maxUsd: number;
}) {
  const highPlus = s.severity.critical + s.severity.high;
  const usd = s.cost?.estimatedUsd ?? 0;
  const highPerDollar = usd > 0 ? highPlus / usd : null;
  const running = s.status === "running";

  return (
    <article
      className={cx(
        "flex flex-col overflow-hidden rounded-box border bg-base-100 transition",
        running
          ? "border-primary/40 ring-1 ring-primary/20"
          : checked
            ? "border-secondary/40 ring-1 ring-secondary/15"
            : "border-base-300 hover:border-base-content/20",
      )}
    >
      <div className="flex gap-2.5 p-3.5">
        <label className="flex cursor-pointer items-start pt-0.5">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-secondary"
            checked={checked}
            onChange={onToggle}
            aria-label={`Selecionar ${s.displayName}`}
          />
        </label>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Link
              to={`/scans/${s.id}`}
              className="font-display text-[15px] font-bold tracking-tight hover:text-primary"
            >
              {s.displayName}
            </Link>
            <StatusBadge status={s.status} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-base-content/55">
            <span className="rounded border border-base-300 bg-base-200 px-1 py-px">
              {s.model ?? "—"}/{s.effort ?? "—"}
            </span>
            <span className="truncate">{shortId(s.id)}</span>
          </div>
          <p className="mt-1 truncate font-mono text-[10px] text-base-content/40">
            {s.repositoryPath ?? s.scanDir}
          </p>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            <Mini label="Custo" value={formatUsd(usd)} accent />
            <Mini
              label="Findings"
              value={
                <>
                  {s.severity.total}
                  {highPlus > 0 && <span className="text-error"> · {highPlus}h</span>}
                </>
              }
            />
            <Mini
              label="High/$"
              value={highPerDollar != null ? highPerDollar.toFixed(2) : "—"}
              tone={highPlus > 0 ? "error" : undefined}
            />
          </div>

          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-base-200">
            {s.severity.critical + s.severity.high > 0 && (
              <span
                className="bg-error"
                style={{
                  width: `${((s.severity.critical + s.severity.high) / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.medium > 0 && (
              <span
                className="bg-warning"
                style={{
                  width: `${(s.severity.medium / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.low > 0 && (
              <span
                className="bg-info"
                style={{
                  width: `${(s.severity.low / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.total === 0 && <span className="w-full bg-base-content/10" />}
          </div>

          {running && s.progress ? (
            <ScanProgressBar
              progress={s.progress}
              status={s.status}
              compact
              className="mt-2"
            />
          ) : (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-base-200">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${Math.max(4, (usd / maxUsd) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-base-300/80 bg-base-200/35 px-3.5 py-2">
        <div className="min-w-0 text-[10px] text-base-content/50">
          <LiveDuration
            startedAt={s.startedAt}
            completedAt={s.completedAt}
            status={s.status}
            durationMs={s.durationMs}
            className="text-[11px] font-medium text-base-content/70"
          />
          <span className="mx-1">·</span>
          <span className="truncate">{formatDate(s.startedAt)}</span>
        </div>
        <Link to={`/scans/${s.id}`} className="btn btn-primary btn-xs gap-1 shrink-0">
          Abrir
          <HugeiconsIcon icon={ArrowRight01Icon} size={11} />
        </Link>
      </div>
    </article>
  );
}

function ScanRow({
  scan: s,
  checked,
  onToggle,
}: {
  scan: ScanRun;
  checked: boolean;
  onToggle: () => void;
}) {
  const highPlus = s.severity.critical + s.severity.high;
  const usd = s.cost?.estimatedUsd ?? 0;
  const running = s.status === "running";

  return (
    <li
      className={cx(
        "transition hover:bg-base-200/50",
        running && "bg-primary/5",
        checked && "bg-secondary/5",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 sm:grid sm:grid-cols-[1.5rem_1fr_7rem_5.5rem_6.5rem_5.5rem_4.5rem] sm:gap-3">
        <label className="flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-secondary"
            checked={checked}
            onChange={onToggle}
            aria-label={`Selecionar ${s.displayName}`}
          />
        </label>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to={`/scans/${s.id}`}
              className="truncate font-semibold hover:text-primary"
            >
              {s.displayName}
            </Link>
            <StatusBadge status={s.status} />
            <span className="hidden font-mono text-[10px] text-base-content/45 sm:inline">
              {s.model}/{s.effort}
            </span>
          </div>
          <p className="truncate font-mono text-[10px] text-base-content/40 sm:hidden">
            {s.model}/{s.effort} · {formatUsd(usd)}
          </p>
        </div>

        <div className="hidden text-right font-mono text-sm font-semibold tabular-nums text-primary sm:block">
          {formatUsd(usd)}
        </div>

        <div className="hidden text-right font-mono text-sm tabular-nums sm:block">
          {s.severity.total}
          {highPlus > 0 && <span className="ml-1 text-error">{highPlus}h</span>}
        </div>

        <div className="hidden sm:block">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-base-200">
            {s.severity.critical + s.severity.high > 0 && (
              <span
                className="bg-error"
                style={{
                  width: `${((s.severity.critical + s.severity.high) / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.medium > 0 && (
              <span
                className="bg-warning"
                style={{
                  width: `${(s.severity.medium / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.low > 0 && (
              <span
                className="bg-info"
                style={{
                  width: `${(s.severity.low / Math.max(1, s.severity.total)) * 100}%`,
                }}
              />
            )}
            {s.severity.total === 0 && <span className="w-full bg-base-content/10" />}
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-base-content/40">
            {s.severity.critical}c {s.severity.high}h {s.severity.medium}m {s.severity.low}l
          </div>
        </div>

        <div className="hidden min-w-0 text-right sm:block">
          {running && s.progress ? (
            <ScanProgressBar progress={s.progress} status={s.status} compact />
          ) : (
            <LiveDuration
              startedAt={s.startedAt}
              completedAt={s.completedAt}
              status={s.status}
              durationMs={s.durationMs}
              className="text-xs"
            />
          )}
        </div>

        <div className="shrink-0 text-right">
          <Link to={`/scans/${s.id}`} className="btn btn-ghost btn-xs gap-0.5 text-primary">
            Abrir
            <HugeiconsIcon icon={ArrowRight01Icon} size={11} />
          </Link>
        </div>
      </div>
      {running && s.progress && (
        <div className="border-t border-base-300/60 px-3 pb-2.5 pt-1.5 sm:hidden">
          <ScanProgressBar progress={s.progress} status={s.status} compact />
        </div>
      )}
    </li>
  );
}

function Mini({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  tone?: "error";
}) {
  return (
    <div className="rounded-lg border border-base-300/70 bg-base-200/40 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wide text-base-content/45">
        {label}
      </div>
      <div
        className={cx(
          "mt-0.5 font-mono text-xs font-bold tabular-nums",
          accent && "text-primary",
          tone === "error" && "text-error",
        )}
      >
        {value}
      </div>
    </div>
  );
}
