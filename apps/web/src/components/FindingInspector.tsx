import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  CodeIcon,
  Copy01Icon,
  FileCodeIcon,
  HierarchyIcon,
  Route01Icon,
  SecurityCheckIcon,
  SourceCodeIcon,
  Tag01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { FindingDetail } from "@csb/shared";
import { CodeBlock } from "./CodeBlock";
import { EmptyState, LevelPill, SeverityBadge, cx } from "./ui";

type InspectorTab = "resumo" | "attack" | "evidence" | "fix";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function levelOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  const r = asRecord(v);
  return r ? asString(r.level) : null;
}

function whyOf(v: unknown): string | null {
  const r = asRecord(v);
  return r ? asString(r.why) : null;
}

export function FindingInspector({
  finding,
  onClose,
}: {
  finding: FindingDetail | null;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("resumo");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (finding?.findingId) setTab("resumo");
  }, [finding?.findingId]);

  const attack = asRecord(finding?.attackPath);
  const dataflow = asRecord(attack?.dataflow);
  const reach = asRecord(attack?.reachability);
  const validation = asRecord(finding?.validation);
  const rootCause = asRecord(finding?.rootCause);
  const taxonomy = asRecord(finding?.taxonomy);
  const category = finding?.category ?? asString(taxonomy?.category);
  const cweList = finding?.cwe?.length
    ? finding.cwe
    : Array.isArray(taxonomy?.cwe)
      ? (taxonomy!.cwe as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  const confidenceLevel = finding?.confidence ?? null;

  const evidence = useMemo(
    () =>
      Array.isArray(finding?.codeEvidence)
        ? (finding!.codeEvidence as Array<Record<string, unknown>>)
        : [],
    [finding],
  );
  const locations = useMemo(
    () =>
      Array.isArray(finding?.locations)
        ? (finding!.locations as Array<Record<string, unknown>>)
        : [],
    [finding],
  );
  const preventive = useMemo(() => {
    const p = finding?.preventiveControls;
    if (Array.isArray(p)) return p.filter((x): x is string => typeof x === "string");
    if (typeof p === "string") return [p];
    return [];
  }, [finding]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      // ignore
    }
  }

  if (!finding) {
    return (
      <div className="flex h-full min-h-[28rem] flex-col bg-base-100">
        <div className="border-b border-base-300 px-4 py-3">
          <div className="font-display text-sm font-semibold">Inspector</div>
          <p className="text-[11px] text-base-content/55">
            Selecione um finding — CWE, ataque, evidência e correção
          </p>
        </div>
        <EmptyState
          title="Nada selecionado"
          description="A lista à esquerda mostra os findings do scan."
          icon={CodeIcon}
        />
      </div>
    );
  }

  const impact = levelOf(attack?.impact);
  const likelihood = levelOf(attack?.likelihood);
  const summaryDistinct =
    finding.summary && finding.summary.trim() !== finding.title.trim()
      ? finding.summary
      : null;

  const tabs: Array<{ id: InspectorTab; label: string; count?: number }> = [
    { id: "resumo", label: "Resumo" },
    { id: "attack", label: "Ataque" },
    { id: "evidence", label: "Evidência", count: evidence.length },
    { id: "fix", label: "Correção" },
  ];

  const rail =
    finding.severity === "critical" || finding.severity === "high"
      ? "border-l-error"
      : finding.severity === "medium"
        ? "border-l-warning"
        : finding.severity === "low"
          ? "border-l-info"
          : "border-l-base-300";

  return (
    <div className="flex h-full min-h-[28rem] flex-col bg-base-100">
      <div
        className={cx(
          "sticky top-0 z-10 border-b border-base-300 border-l-4 bg-base-100/95 backdrop-blur",
          rail,
        )}
      >
        <div className="px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={finding.severity} />
            {confidenceLevel && <LevelPill label="conf" level={confidenceLevel} />}
            {cweList.map((c) => (
              <span
                key={c}
                className="rounded-md border border-secondary/35 bg-secondary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary"
              >
                {c}
              </span>
            ))}
            {category && (
              <span className="rounded-md border border-primary/30 bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {category}
              </span>
            )}
            {onClose && (
              <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={onClose}>
                Fechar
              </button>
            )}
          </div>
          <h3 className="font-display text-base font-bold leading-snug tracking-tight sm:text-[1.05rem]">
            {finding.title}
          </h3>
          {finding.primaryPath && (
            <button
              type="button"
              className="mt-1.5 flex max-w-full items-center gap-1.5 rounded-md bg-base-200/80 px-2 py-1 font-mono text-[11px] text-base-content/70 hover:text-primary"
              onClick={() => void copy(finding.primaryPath!, "path")}
            >
              <HugeiconsIcon icon={FileCodeIcon} size={12} />
              <span className="truncate">{finding.primaryPath}</span>
              <HugeiconsIcon icon={Copy01Icon} size={11} />
              {copied === "path" && <span className="text-success">ok</span>}
            </button>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <LevelPill label="impacto" level={impact} />
            <LevelPill label="prob." level={likelihood} />
            {asString(reach?.attacker) && (
              <span className="rounded-md border border-base-300 bg-base-200 px-1.5 py-0.5 text-[11px]">
                <span className="text-base-content/50">atacante </span>
                <span className="font-medium">{asString(reach?.attacker)}</span>
              </span>
            )}
            {finding.ruleId && (
              <span className="rounded-md border border-base-300 bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-base-content/65">
                {finding.ruleId}
              </span>
            )}
          </div>

          {/* Ref-style segmented control: recessed track + light elevated active pill */}
          <div
            role="tablist"
            className="mt-3 flex gap-0.5 rounded-full bg-base-200 p-1 ring-1 ring-base-content/10"
          >
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cx(
                    "flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition",
                    active
                      ? "bg-base-content text-base-100 shadow-sm"
                      : "text-base-content/55 hover:bg-base-content/5 hover:text-base-content/85",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count != null && t.count > 0 ? (
                    <span
                      className={cx(
                        "ml-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 font-mono text-[11px] font-bold tabular-nums",
                        active
                          ? "bg-base-100/20 text-base-100"
                          : "bg-primary/20 text-primary",
                      )}
                    >
                      {t.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {tab === "resumo" && (
          <>
            {summaryDistinct && (
              <p className="text-[13px] leading-relaxed text-base-content/85">{summaryDistinct}</p>
            )}

            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-base-300 bg-base-300 sm:grid-cols-2">
              <Fact k="Impacto" v={impact ?? "—"} tone={impact} detail={whyOf(attack?.impact)} />
              <Fact
                k="Probabilidade"
                v={likelihood ?? "—"}
                tone={likelihood}
                detail={whyOf(attack?.likelihood)}
              />
              <Fact k="Atacante" v={asString(reach?.attacker) ?? "—"} />
              <Fact
                k="Confiança"
                v={confidenceLevel ?? "—"}
                tone={confidenceLevel}
                detail={finding.confidenceRationale}
              />
            </dl>

            {(asString(dataflow?.source) || asString(dataflow?.sink)) && (
              <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                  <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={12} />
                  Source → sink
                </div>
                <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
                  <div className="flex gap-2">
                    <span className="shrink-0 rounded bg-warning/20 px-1 text-warning">src</span>
                    <span className="break-all text-base-content/80">
                      {asString(dataflow?.source) ?? "—"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="shrink-0 rounded bg-error/20 px-1 text-error">sink</span>
                    <span className="break-all text-base-content/80">
                      {asString(dataflow?.sink) ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {finding.severityRationale && (
              <Block title="Por que essa severidade" icon={Target01Icon} accent="error">
                {finding.severityRationale}
              </Block>
            )}

            {asString(rootCause?.summary) && (
              <Block title="Causa raiz" icon={HierarchyIcon} accent="primary">
                {asString(rootCause?.summary)!}
              </Block>
            )}

            {asString(reach?.preconditions) && (
              <Block title="Pré-condições" icon={Route01Icon}>
                {asString(reach?.preconditions)!}
              </Block>
            )}

            {locations.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                  Localizações ({locations.length})
                </h4>
                <ul className="space-y-1">
                  {locations.map((loc, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-base-300/80 bg-base-200/50 px-2 py-1.5 font-mono text-[11px]"
                    >
                      <RolePill role={String(loc.role ?? "")} />
                      <span className="min-w-0 flex-1 break-all text-base-content/80">
                        {String(loc.path ?? "")}
                        {loc.startLine != null ? `:${String(loc.startLine)}` : ""}
                        {loc.endLine != null ? `–${String(loc.endLine)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-base-300 pt-3 font-mono text-[11px]">
              <dt className="text-base-content/45">finding</dt>
              <dd className="truncate text-right">
                <Copyable
                  text={finding.findingId}
                  copied={copied === "fid"}
                  onCopy={() => void copy(finding.findingId, "fid")}
                />
              </dd>
              {finding.occurrenceId && (
                <>
                  <dt className="text-base-content/45">occurrence</dt>
                  <dd className="truncate text-right">{finding.occurrenceId}</dd>
                </>
              )}
              {finding.fingerprints[0] && (
                <>
                  <dt className="text-base-content/45">fingerprint</dt>
                  <dd className="truncate text-right">
                    <Copyable
                      text={finding.fingerprints[0]}
                      copied={copied === "fp"}
                      onCopy={() => void copy(finding.fingerprints[0], "fp")}
                    />
                  </dd>
                </>
              )}
            </dl>
          </>
        )}

        {tab === "attack" && (
          <>
            {!attack && !validation ? (
              <EmptyState
                title="Sem caminho de ataque"
                description="Este finding não trouxe attack path estruturado."
                icon={Route01Icon}
              />
            ) : (
              <>
                {asString(attack?.summary) && (
                  <p className="text-[13px] leading-relaxed text-base-content/85">
                    {asString(attack?.summary)}
                  </p>
                )}

                {(asString(dataflow?.source) || asString(dataflow?.sink)) && (
                  <section>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                      Fluxo
                    </h4>
                    <ol className="space-y-1">
                      <FlowStep
                        step="1"
                        label="Source"
                        value={asString(dataflow?.source) ?? "—"}
                        tone="warning"
                      />
                      <div className="flex justify-center text-base-content/30">
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                      </div>
                      {asString(reach?.entrypoint) && (
                        <>
                          <FlowStep
                            step="2"
                            label="Entrypoint"
                            value={asString(reach?.entrypoint)!}
                            tone="info"
                          />
                          <div className="flex justify-center text-base-content/30">
                            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                          </div>
                        </>
                      )}
                      <FlowStep
                        step="3"
                        label="Sink"
                        value={asString(dataflow?.sink) ?? "—"}
                        tone="error"
                      />
                    </ol>
                    {asString(dataflow?.outcome) && (
                      <p className="mt-2 rounded-lg border border-error/25 bg-error/10 px-2.5 py-2 text-xs leading-relaxed text-base-content/80">
                        {asString(dataflow?.outcome)}
                      </p>
                    )}
                  </section>
                )}

                {reach && (
                  <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 rounded-xl border border-base-300 bg-base-200/40 px-3 py-2.5 text-xs">
                    <dt className="text-base-content/50">Atacante</dt>
                    <dd className="font-medium">{asString(reach.attacker) ?? "—"}</dd>
                    <dt className="text-base-content/50">Pré-condições</dt>
                    <dd>{asString(reach.preconditions) ?? "—"}</dd>
                    <dt className="text-base-content/50">Resultado</dt>
                    <dd>{asString(reach.outcome) ?? "—"}</dd>
                  </dl>
                )}

                {validation && (
                  <section>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} />
                      Validação
                    </h4>
                    {asString(validation.method) && (
                      <p className="mb-1 font-mono text-[11px] text-secondary">
                        {asString(validation.method)}
                      </p>
                    )}
                    {asString(validation.summary) && (
                      <p className="mb-2 text-xs leading-relaxed text-base-content/80">
                        {asString(validation.summary)}
                      </p>
                    )}
                    {Array.isArray(validation.assertions) && (
                      <ul className="space-y-1">
                        {(validation.assertions as unknown[]).map((a, i) =>
                          typeof a === "string" ? (
                            <li key={i} className="flex gap-2 text-xs leading-snug text-base-content/75">
                              <span className="text-success">✓</span>
                              <span>{a}</span>
                            </li>
                          ) : null,
                        )}
                      </ul>
                    )}
                    {Array.isArray(validation.limitations) &&
                      (validation.limitations as unknown[]).some((l) => typeof l === "string") && (
                        <div className="mt-2 rounded-lg border border-warning/35 bg-warning/10 px-2.5 py-2 text-xs">
                          <div className="mb-1 font-semibold text-warning">Limitações</div>
                          {(validation.limitations as unknown[]).map((l, i) =>
                            typeof l === "string" ? <p key={i}>{l}</p> : null,
                          )}
                        </div>
                      )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {tab === "evidence" && (
          <div className="space-y-2">
            {evidence.length === 0 ? (
              <EmptyState title="Sem evidência de código" icon={SourceCodeIcon} />
            ) : (
              evidence.map((ev, i) => (
                <article
                  key={String(ev.id ?? i)}
                  className="overflow-hidden rounded-xl border border-base-300"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-200/80 px-2.5 py-1.5">
                    <RolePill role={String(ev.role ?? "")} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-base-content/70">
                      {String(ev.path ?? "")}
                      {ev.startLine != null ? `:${String(ev.startLine)}` : ""}
                      {ev.endLine != null ? `–${String(ev.endLine)}` : ""}
                    </span>
                    {typeof ev.language === "string" && (
                      <span className="rounded bg-secondary/15 px-1 font-mono text-[10px] text-secondary">
                        {ev.language}
                      </span>
                    )}
                  </div>
                  {typeof ev.explanation === "string" && (
                    <p className="border-b border-base-300/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-base-content/70">
                      {ev.explanation}
                    </p>
                  )}
                  {typeof ev.code === "string" && (
                    <CodeBlock
                      code={ev.code}
                      language={typeof ev.language === "string" ? ev.language : null}
                      path={typeof ev.path === "string" ? ev.path : null}
                      startLine={
                        typeof ev.startLine === "number"
                          ? ev.startLine
                          : typeof ev.startLine === "string"
                            ? Number(ev.startLine) || null
                            : null
                      }
                      showChrome={false}
                    />
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {tab === "fix" && (
          <div className="space-y-3">
            {finding.remediation != null && (
              <div className="rounded-xl border border-success/35 bg-success/10 px-3 py-2.5 text-[13px] leading-relaxed">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                  <HugeiconsIcon icon={SecurityCheckIcon} size={12} />
                  Remediação
                </div>
                {typeof finding.remediation === "string"
                  ? finding.remediation
                  : JSON.stringify(finding.remediation, null, 2)}
              </div>
            )}
            {preventive.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                  Controles preventivos
                </h4>
                <ul className="space-y-1">
                  {preventive.map((p, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-lg border border-primary/25 bg-primary/8 px-2.5 py-1.5 text-xs leading-relaxed"
                    >
                      <span className="text-primary">→</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {finding.remediationTests != null && (
              <section>
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                  Testes sugeridos
                </h4>
                <div className="overflow-hidden rounded-xl border border-base-300">
                  <CodeBlock
                    code={
                      typeof finding.remediationTests === "string"
                        ? finding.remediationTests
                        : JSON.stringify(finding.remediationTests, null, 2)
                    }
                    language={
                      typeof finding.remediationTests === "string" ? "typescript" : "json"
                    }
                  />
                </div>
              </section>
            )}
            {!finding.remediation &&
              preventive.length === 0 &&
              finding.remediationTests == null && (
                <EmptyState title="Sem remediação estruturada" icon={SecurityCheckIcon} />
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  k,
  v,
  tone,
  detail,
}: {
  k: string;
  v: string;
  tone?: string | null;
  detail?: string | null;
}) {
  return (
    <div className="bg-base-100 px-3 py-2.5" title={detail ?? undefined}>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-base-content/45">{k}</dt>
      <dd className="mt-0.5">
        <span
          className={cx(
            "font-mono text-sm font-bold capitalize",
            tone && ["high", "critical"].includes(tone.toLowerCase()) && "text-error",
            tone?.toLowerCase() === "medium" && "text-warning",
            tone?.toLowerCase() === "low" && "text-info",
          )}
        >
          {v}
        </span>
      </dd>
      {detail && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-base-content/55">{detail}</p>
      )}
    </div>
  );
}

function Block({
  title,
  icon,
  children,
  accent,
}: {
  title: string;
  icon: typeof Tag01Icon;
  children: ReactNode;
  accent?: "error" | "primary";
}) {
  return (
    <section
      className={cx(
        "rounded-xl border px-3 py-2.5",
        accent === "error" && "border-error/30 bg-error/8",
        accent === "primary" && "border-primary/30 bg-primary/8",
        !accent && "border-base-300 bg-base-200/40",
      )}
    >
      <h4 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
        <HugeiconsIcon icon={icon} size={12} />
        {title}
      </h4>
      <p className="text-xs leading-relaxed text-base-content/85">{children}</p>
    </section>
  );
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, string> = {
    source: "bg-warning/20 text-warning border-warning/35",
    sink: "bg-error/20 text-error border-error/35",
    entrypoint: "bg-info/20 text-info border-info/35",
    root_control: "bg-primary/15 text-primary border-primary/30",
    concrete_implementation: "bg-secondary/15 text-secondary border-secondary/30",
  };
  return (
    <span
      className={cx(
        "shrink-0 rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase",
        map[role] ?? "border-base-300 bg-base-200 text-base-content/60",
      )}
    >
      {role || "loc"}
    </span>
  );
}

function FlowStep({
  step,
  label,
  value,
  tone,
}: {
  step: string;
  label: string;
  value: string;
  tone: "warning" | "error" | "info";
}) {
  const border =
    tone === "error"
      ? "border-error/40 bg-error/8"
      : tone === "warning"
        ? "border-warning/40 bg-warning/8"
        : "border-info/40 bg-info/8";
  return (
    <li className={cx("rounded-lg border px-2.5 py-2", border)}>
      <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
        <span className="opacity-40">{step}</span>
        {label}
      </div>
      <p className="break-all font-mono text-[11px] leading-relaxed text-base-content/85">{value}</p>
    </li>
  );
}

function Copyable({
  text,
  onCopy,
  copied,
}: {
  text: string;
  onCopy: () => void;
  copied?: boolean;
}) {
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-1 hover:text-primary"
      onClick={onCopy}
    >
      <span className="truncate">{text}</span>
      <HugeiconsIcon icon={Copy01Icon} size={11} />
      {copied ? <span className="text-success">ok</span> : null}
    </button>
  );
}
