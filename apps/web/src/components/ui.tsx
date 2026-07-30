import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import clsx from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useElapsedMs } from "../hooks";
import { formatDuration } from "../format";

export function cx(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-normal sm:text-[2.1rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-2xl text-[0.95rem] leading-relaxed text-base-content/65">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconSvgElement;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-box border border-base-300/80 bg-base-100 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-base-content/55">{label}</span>
        {icon && (
          <span className="rounded-lg bg-base-200 p-1.5 text-base-content/70">
            <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div
        className={cx(
          "mt-2 font-display text-[1.75rem] font-semibold tracking-normal tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-base-content/50">{hint}</div>}
      {children}
    </div>
  );
}

export function Surface({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-box border border-base-300/80 bg-base-100 shadow-sm",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-base-300/70 px-4 py-3 sm:px-5">
          <div className="font-display text-[0.95rem] font-semibold tracking-tight">{title}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  completed: "concluído",
  running: "rodando",
  failed: "falhou",
  cancelled: "cancelado",
  queued: "na fila",
  incomplete: "incompleto",
};

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "badge-success",
    running: "badge-primary",
    failed: "badge-error",
    cancelled: "badge-ghost border border-error/40 text-error",
    queued: "badge-ghost",
    incomplete: "badge-warning",
  };
  return (
    <span className={cx("badge badge-sm gap-1.5 font-mono", map[status] ?? "badge-ghost")}>
      {status === "running" ? <span className="live-dot" /> : <span className="status status-sm" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Soft tint + saturated text — readable in dark and light (ref: pastel tags). */
export function severityTone(severity: string): string {
  const map: Record<string, string> = {
    critical: "bg-error/25 text-error border-error/40",
    high: "bg-error/18 text-error border-error/35",
    medium: "bg-warning/22 text-warning border-warning/40",
    low: "bg-info/20 text-info border-info/35",
    info: "bg-base-content/10 text-base-content/70 border-base-content/15",
  };
  return map[severity] ?? "bg-base-content/10 text-base-content/60 border-base-content/15";
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
        severityTone(severity),
      )}
    >
      {severity}
    </span>
  );
}

export function LevelPill({
  label,
  level,
}: {
  label?: string;
  level: string | null | undefined;
}) {
  const lv = (level ?? "—").toLowerCase();
  const tone =
    lv === "critical" || lv === "high"
      ? "bg-error/18 text-error border-error/35"
      : lv === "medium"
        ? "bg-warning/20 text-warning border-warning/35"
        : lv === "low"
          ? "bg-info/18 text-info border-info/30"
          : "bg-base-200 text-base-content/70 border-base-300";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
        tone,
      )}
    >
      {label && <span className="opacity-70">{label}</span>}
      <span className="font-mono font-semibold capitalize">{level ?? "—"}</span>
    </span>
  );
}

export function SevRail({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-error",
    high: "bg-error/80",
    medium: "bg-warning",
    low: "bg-info",
    info: "bg-base-content/30",
  };
  return <span className={cx("w-1 shrink-0 self-stretch rounded-full", map[severity] ?? "bg-base-content/25")} />;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: IconSvgElement;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <div className="rounded-2xl bg-base-200 p-3 text-base-content/45">
          <HugeiconsIcon icon={icon} size={26} strokeWidth={1.6} />
        </div>
      )}
      <div>
        <p className="font-display text-lg font-semibold">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-base-content/55">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function AlertBanner({
  tone = "error",
  children,
}: {
  tone?: "error" | "warning" | "info" | "success";
  children: ReactNode;
}) {
  return (
    <div role="alert" className={cx("alert mb-4 text-sm", `alert-${tone}`)}>
      <span>{children}</span>
    </div>
  );
}

export function SeverityBar({
  high,
  medium,
  low,
}: {
  high: number;
  medium: number;
  low: number;
}) {
  const total = Math.max(1, high + medium + low);
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-base-200">
      <span className="bg-error" style={{ width: `${(high / total) * 100}%` }} />
      <span className="bg-warning" style={{ width: `${(medium / total) * 100}%` }} />
      <span className="bg-info" style={{ width: `${(low / total) * 100}%` }} />
    </div>
  );
}

/** Phase-based progress bar for running (and completed) scans. */
export function ScanProgressBar({
  progress,
  status,
  compact = false,
  className,
}: {
  progress?: {
    percent: number;
    phaseLabel: string;
    detail?: string | null;
  } | null;
  status?: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!progress) return null;
  const running = status === "running" || status === "queued";
  const done = status === "completed" || progress.percent >= 100;
  if (!running && !done) return null;

  return (
    <div className={cx("min-w-0", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span
          className={cx(
            "truncate font-medium",
            compact ? "text-[10px] text-base-content/60" : "text-xs text-base-content/70",
          )}
        >
          {progress.phaseLabel}
          {progress.detail ? (
            <span className="font-normal text-base-content/45">
              {" · "}
              {progress.detail}
            </span>
          ) : null}
        </span>
        <span
          className={cx(
            "shrink-0 font-mono tabular-nums font-semibold",
            compact ? "text-[10px]" : "text-xs",
            running ? "text-primary" : "text-success",
          )}
        >
          {Math.round(progress.percent)}%
        </span>
      </div>
      <div
        className={cx(
          "overflow-hidden rounded-full bg-base-200",
          compact ? "h-1" : "h-1.5",
        )}
        role="progressbar"
        aria-valuenow={Math.round(progress.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso ${Math.round(progress.percent)}%`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            done ? "bg-success" : "bg-primary",
            running && "progress-pulse",
          )}
          style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
        />
      </div>
    </div>
  );
}

/** Live duration for a scan — ticks while running. */
export function LiveDuration({
  startedAt,
  completedAt,
  status,
  durationMs,
  className,
  showDot = false,
}: {
  startedAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
  durationMs?: number | null;
  className?: string;
  /** Avoid when StatusBadge already shows a live-dot nearby. */
  showDot?: boolean;
}) {
  const elapsed = useElapsedMs(startedAt, status, completedAt);
  const running = status === "running";
  const value =
    running || elapsed != null
      ? elapsed
      : durationMs != null
        ? durationMs
        : null;

  return (
    <span
      className={cx(
        "font-mono tabular-nums",
        running && "text-primary",
        className,
      )}
      title={running ? "Tempo decorrido (ao vivo)" : "Duração"}
    >
      {running && showDot && (
        <span className="live-dot mr-1.5 inline-block align-middle" />
      )}
      {formatDuration(value)}
    </span>
  );
}
