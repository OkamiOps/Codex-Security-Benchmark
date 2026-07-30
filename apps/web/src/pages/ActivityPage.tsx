import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  ArrowRight01Icon,
  Bug01Icon,
  PlusSignIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import type { ScanRun } from "@csb/shared";
import { api } from "../api";
import {
  AlertBanner,
  EmptyState,
  LiveDuration,
  PageHeader,
  StatusBadge,
  cx,
} from "../components/ui";
import { formatDate, formatUsd } from "../format";

export function ActivityPage() {
  const [scans, setScans] = useState<ScanRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { scans: list } = await api.listScans();
      setScans(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar atividade");
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, []);

  const active = useMemo(() => scans.filter((s) => s.status === "running"), [scans]);
  const history = useMemo(
    () => scans.filter((s) => s.status !== "running").slice(0, 20),
    [scans],
  );

  const spentToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return scans
      .filter((s) => s.startedAt && new Date(s.startedAt) >= start)
      .reduce((acc, s) => acc + (s.cost?.estimatedUsd ?? 0), 0);
  }, [scans]);

  return (
    <div>
      <PageHeader
        title="Atividade"
        description="O que está rodando agora e o histórico recente — tempo ao vivo nos runs ativos."
        actions={
          <Link to="/scans/new" className="btn btn-primary btn-sm gap-2">
            <HugeiconsIcon icon={PlusSignIcon} size={15} />
            Novo scan
          </Link>
        }
      />

      {error && <AlertBanner>{error}</AlertBanner>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <PulseStat label="Ativos" value={String(active.length)} accent={active.length > 0} />
        <PulseStat label="Runs indexados" value={String(scans.length)} />
        <PulseStat label="Gasto hoje" value={formatUsd(spentToday)} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">Em execução</h2>
          {active.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span className="live-dot" />
              ao vivo
            </span>
          )}
        </div>

        {active.length === 0 ? (
          <div className="rounded-box border border-dashed border-base-300 bg-base-100/60">
            <EmptyState
              title="Nada rodando"
              description="Inicie um scan para acompanhar duração e custo em tempo real."
              icon={Activity01Icon}
              action={
                <Link to="/scans/new" className="btn btn-outline btn-sm">
                  Iniciar scan
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((s) => (
              <ActiveCard key={s.id} scan={s} onCancel={() => void api.cancelScan(s.id).then(load)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold tracking-tight">Histórico</h2>
        {history.length === 0 ? (
          <div className="rounded-box border border-base-300 bg-base-100">
            <EmptyState title="Sem histórico" description="Runs concluídos aparecem aqui." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
            <ol className="divide-y divide-base-300/60">
              {history.map((s) => (
                <HistoryRow key={s.id} scan={s} />
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function PulseStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3.5">
      <div className="text-[11px] font-medium text-base-content/50">{label}</div>
      <div
        className={cx(
          "mt-1 font-display text-2xl font-bold tracking-tight tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ActiveCard({ scan: s, onCancel }: { scan: ScanRun; onCancel: () => void }) {
  return (
    <article className="relative overflow-hidden rounded-box border border-primary/35 bg-base-100 ring-1 ring-primary/15">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <span className="badge badge-ghost badge-sm font-mono">
              {s.model}/{s.effort}
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight">{s.displayName}</h3>
          <p className="mt-1 truncate font-mono text-[11px] text-base-content/45">
            {s.repositoryPath ?? s.scanDir}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-[16rem]">
          <div className="rounded-xl bg-base-200/60 px-3.5 py-3">
            <div className="text-[11px] text-base-content/50">Decorrido</div>
            <LiveDuration
              startedAt={s.startedAt}
              completedAt={s.completedAt}
              status={s.status}
              durationMs={s.durationMs}
              className="text-2xl font-bold"
            />
          </div>
          <div className="rounded-xl bg-base-200/60 px-3.5 py-3">
            <div className="text-[11px] text-base-content/50">Custo est.</div>
            <div className="font-display text-2xl font-bold tabular-nums text-primary">
              {formatUsd(s.cost?.estimatedUsd)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-col">
          <Link to={`/scans/${s.id}`} className="btn btn-primary btn-sm gap-1">
            Abrir
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </Link>
          <button type="button" className="btn btn-error btn-outline btn-sm gap-1" onClick={onCancel}>
            <HugeiconsIcon icon={StopIcon} size={14} />
            Cancelar
          </button>
        </div>
      </div>
    </article>
  );
}

function HistoryRow({ scan: s }: { scan: ScanRun }) {
  const high = (s.severity?.high ?? 0) + (s.severity?.critical ?? 0);
  return (
    <li>
      <Link
        to={`/scans/${s.id}`}
        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-base-200/55 sm:gap-4 sm:px-5"
      >
        <span
          className={cx(
            "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
            s.status === "completed" && "bg-success",
            s.status === "failed" && "bg-error",
            s.status === "cancelled" && "bg-error/70",
            s.status === "incomplete" && "bg-warning",
            !["completed", "failed", "cancelled", "incomplete"].includes(s.status) &&
              "bg-base-content/30",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{s.displayName}</span>
            <StatusBadge status={s.status} />
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-base-content/45">
            {s.model}/{s.effort} · {formatDate(s.startedAt)}
          </div>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-base-content/50 sm:flex">
          <HugeiconsIcon icon={Bug01Icon} size={13} />
          <span className="font-mono tabular-nums">
            {high}h · {s.severity?.total ?? 0}
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm tabular-nums">{formatUsd(s.cost?.estimatedUsd)}</div>
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
