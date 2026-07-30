import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  DollarCircleIcon,
  FlashIcon,
  Folder01Icon,
  FolderOpenIcon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import type { FsListResponse, HealthResponse } from "@csb/shared";
import { api } from "../api";
import { AlertBanner, PageHeader, cx } from "../components/ui";

const PREFS_KEY = "csb-launch-prefs";

const EFFORTS = [
  { id: "minimal", hint: "rápido / barato" },
  { id: "low", hint: "leve" },
  { id: "medium", hint: "equilíbrio" },
  { id: "high", hint: "recomendado" },
  { id: "xhigh", hint: "máximo" },
] as const;

const MODELS = [
  { id: "gpt-5.6-sol", hint: "padrão Codex Security" },
  { id: "gpt-5.6-terra", hint: "alternativa" },
] as const;

type LaunchPrefs = {
  model?: string;
  effort?: string;
  mode?: "standard" | "deep";
  maxCostUsd?: string;
  unlimitedCost?: boolean;
  paths?: string;
  repositoryPath?: string;
};

function loadPrefs(): LaunchPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LaunchPrefs;
  } catch {
    return {};
  }
}

function savePrefs(prefs: LaunchPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/** Rough relative cost index for UI guidance only */
function costHint(effort: string, mode: string, max: number) {
  const effortW: Record<string, number> = {
    minimal: 0.15,
    low: 0.3,
    medium: 0.55,
    high: 0.85,
    xhigh: 1,
  };
  const w = (effortW[effort] ?? 0.7) * (mode === "deep" ? 1.35 : 1);
  const typical = Math.round(max * w);
  return { typical, heavy: Math.round(max * Math.min(1, w * 1.4)) };
}

export function NewScanPage() {
  const initial = useMemo(() => loadPrefs(), []);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [fs, setFs] = useState<FsListResponse | null>(null);
  const [repositoryPath, setRepositoryPath] = useState(initial.repositoryPath ?? "");
  const [model, setModel] = useState(() =>
    MODELS.some((m) => m.id === initial.model) ? initial.model! : "gpt-5.6-sol",
  );
  const [effort, setEffort] = useState(() =>
    EFFORTS.some((e) => e.id === initial.effort) ? initial.effort! : "high",
  );
  const [mode, setMode] = useState<"standard" | "deep">(() =>
    initial.mode === "deep" || initial.mode === "standard" ? initial.mode : "standard",
  );
  const [maxCostUsd, setMaxCostUsd] = useState(initial.maxCostUsd ?? "100");
  const [unlimitedCost, setUnlimitedCost] = useState(Boolean(initial.unlimitedCost));
  const [paths, setPaths] = useState(initial.paths ?? "");
  const [confirmCost, setConfirmCost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastStarted, setLastStarted] = useState<{
    id: string;
    model: string;
    effort: string;
    mode: string;
  } | null>(null);

  useEffect(() => {
    void api.health().then(setHealth).catch(() => setHealth(null));
    void api
      .listFs(initial.repositoryPath || undefined)
      .then((r) => {
        setFs(r);
        // Keep persisted repo if browser opened there; otherwise use listing path.
        setRepositoryPath((prev) => prev || r.path);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha no browser de pastas"),
      );
  }, [initial.repositoryPath]);

  useEffect(() => {
    savePrefs({
      model,
      effort,
      mode,
      maxCostUsd,
      unlimitedCost,
      paths,
      repositoryPath,
    });
  }, [model, effort, mode, maxCostUsd, unlimitedCost, paths, repositoryPath]);

  async function openPath(path: string) {
    const r = await api.listFs(path);
    setFs(r);
  }

  const maxN = Math.max(100, Number(maxCostUsd) || 100);
  const hint = useMemo(
    () => costHint(effort, mode, unlimitedCost ? 150 : maxN),
    [effort, mode, maxN, unlimitedCost],
  );
  const repoName = repositoryPath.split("/").filter(Boolean).at(-1) ?? "repo";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLastStarted(null);
    if (!repositoryPath.trim()) {
      setError("Informe o caminho do repositório");
      return;
    }
    if (!confirmCost) {
      setError("Confirme que entende o custo estimado antes de iniciar");
      return;
    }
    if (!unlimitedCost) {
      const n = Number(maxCostUsd);
      if (!Number.isFinite(n) || n < 100) {
        setError("Max cost mínimo é US$ 100 (ou marque sem limite)");
        return;
      }
    }
    // Capture at submit time — never rely on state after await/navigation races.
    const launch = {
      repositoryPath: repositoryPath.trim(),
      model,
      effort,
      mode,
      maxCostUsd: unlimitedCost ? undefined : maxN,
      paths: paths
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    setBusy(true);
    try {
      const { scan } = await api.startScan(launch);
      if (scan.model && scan.model !== launch.model) {
        setError(
          `Scan iniciado, mas o modelo gravado foi ${scan.model} (pedido: ${launch.model}).`,
        );
      }
      setLastStarted({
        id: scan.id,
        model: scan.model ?? launch.model,
        effort: scan.effort ?? launch.effort,
        mode: scan.mode ?? launch.mode,
      });
      void api.health().then(setHealth).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Novo scan"
        description="Escolha o alvo, modelo e effort. O custo é real — o Contion chegou a ~US$ 98 com high."
        actions={
          <Link to="/scans" className="btn btn-ghost btn-sm gap-1">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
            Scans
          </Link>
        }
      />

      {(health?.activeScanIds?.length ?? 0) > 0 && (
        <AlertBanner tone="warning">
          {health!.activeScanIds.length} scan(s) em execução
          {health!.maxConcurrentScans
            ? ` · limite ${health!.maxConcurrentScans}`
            : ""}
          . Custos somam em paralelo.{" "}
          <Link to="/activity" className="link font-medium">
            Ver atividade
          </Link>
        </AlertBanner>
      )}
      {lastStarted && (
        <AlertBanner tone="success">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
            Iniciado com{" "}
            <span className="font-mono font-semibold">
              {lastStarted.model}/{lastStarted.effort}/{lastStarted.mode}
            </span>
            <Link to={`/scans/${lastStarted.id}`} className="link font-medium">
              Abrir scan
            </Link>
            <span className="opacity-70">· formulário mantido pra lançar outro</span>
          </span>
        </AlertBanner>
      )}
      {error && <AlertBanner>{error}</AlertBanner>}

      <form onSubmit={(e) => void onSubmit(e)} className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Target */}
        <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          <div className="flex items-center justify-between gap-3 border-b border-base-300 px-5 py-3.5">
            <div>
              <h2 className="font-display text-base font-semibold">Alvo</h2>
              <p className="text-xs text-base-content/50">Pasta do repositório a analisar</p>
            </div>
            <HugeiconsIcon icon={Folder01Icon} size={18} className="text-base-content/35" />
          </div>

          <div className="space-y-4 p-5">
            <label className="form-control w-full">
              <div className="label py-1">
                <span className="label-text text-xs font-medium text-base-content/55">Caminho</span>
              </div>
              <label className="input input-bordered flex items-center gap-2">
                <HugeiconsIcon icon={Folder01Icon} size={16} className="opacity-45" />
                <input
                  className="grow font-mono text-sm"
                  value={repositoryPath}
                  onChange={(e) => setRepositoryPath(e.target.value)}
                  placeholder="/Users/…/meu-repo"
                />
              </label>
            </label>

            {fs && (
              <div className="overflow-hidden rounded-xl border border-base-300">
                <div className="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-200/50 px-3 py-2.5">
                  {fs.parent && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1"
                      onClick={() => void openPath(fs.parent!)}
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={13} />
                      ..
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-base-content/50">
                    {fs.path}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs gap-1"
                    onClick={() => setRepositoryPath(fs.path)}
                  >
                    <HugeiconsIcon icon={FolderOpenIcon} size={13} />
                    Usar
                  </button>
                </div>
                <div className="max-h-72 overflow-auto">
                  {fs.entries.filter((e) => e.isDirectory).length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-base-content/45">
                      Sem subpastas aqui
                    </p>
                  ) : (
                    fs.entries
                      .filter((e) => e.isDirectory)
                      .map((e) => (
                        <button
                          key={e.path}
                          type="button"
                          className={cx(
                            "flex w-full items-center gap-2.5 border-b border-base-300/40 px-3.5 py-2.5 text-left font-mono text-sm transition",
                            repositoryPath === e.path
                              ? "bg-primary/10 text-primary"
                              : "text-base-content/80 hover:bg-base-200",
                          )}
                          onClick={() => void openPath(e.path)}
                          onDoubleClick={() => {
                            setRepositoryPath(e.path);
                          }}
                        >
                          <HugeiconsIcon icon={Folder01Icon} size={14} className="shrink-0 opacity-60" />
                          <span className="truncate">{e.name}/</span>
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}

            <label className="form-control">
              <div className="label py-1">
                <span className="label-text text-xs font-medium text-base-content/55">
                  Paths opcionais (comma-separated)
                </span>
              </div>
              <input
                className="input input-bordered font-mono text-sm"
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
                placeholder="src, apps/api — vazio = escopo default do CLI"
              />
            </label>
          </div>
        </section>

        {/* Launch panel */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
            <div className="border-b border-base-300 px-5 py-3.5">
              <h2 className="font-display text-base font-semibold">Configuração</h2>
              <p className="text-xs text-base-content/50">Modelo, effort e teto de custo</p>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-base-content/55">
                  <HugeiconsIcon icon={AiBrain01Icon} size={13} />
                  Modelo
                </div>
                <div className="grid gap-2">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={cx(
                        "rounded-xl border px-3.5 py-3 text-left transition",
                        model === m.id
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-base-300 hover:bg-base-200/60",
                      )}
                    >
                      <div className="font-mono text-sm font-semibold">{m.id}</div>
                      <div className="mt-0.5 text-[11px] text-base-content/50">{m.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-base-content/55">
                  <HugeiconsIcon icon={FlashIcon} size={13} />
                  Effort
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EFFORTS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEffort(e.id)}
                      className={cx(
                        "btn btn-sm font-mono",
                        effort === e.id ? "btn-primary" : "btn-ghost border border-base-300",
                      )}
                      title={e.hint}
                    >
                      {e.id}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-base-content/45">
                  {EFFORTS.find((e) => e.id === effort)?.hint}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-2 text-xs font-medium text-base-content/55">Mode</div>
                  <div className="join w-full">
                    <button
                      type="button"
                      className={cx("btn join-item btn-sm flex-1", mode === "standard" && "btn-primary")}
                      onClick={() => setMode("standard")}
                    >
                      standard
                    </button>
                    <button
                      type="button"
                      className={cx("btn join-item btn-sm flex-1", mode === "deep" && "btn-primary")}
                      onClick={() => setMode("deep")}
                    >
                      deep
                    </button>
                  </div>
                </div>
                <label className="form-control">
                  <div className="mb-2 text-xs font-medium text-base-content/55">
                    Max cost USD
                  </div>
                  <input
                    className="input input-bordered input-sm font-mono"
                    type="number"
                    min={100}
                    step="1"
                    disabled={unlimitedCost}
                    value={unlimitedCost ? "" : maxCostUsd}
                    placeholder={unlimitedCost ? "sem limite" : "100"}
                    onChange={(e) => setMaxCostUsd(e.target.value)}
                  />
                </label>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  checked={unlimitedCost}
                  onChange={(e) => setUnlimitedCost(e.target.checked)}
                />
                <span className="text-xs leading-relaxed">
                  <span className="font-medium">Sem limite / sem freio</span>
                  <span className="mt-0.5 block text-base-content/55">
                    Não envia <span className="font-mono">--max-cost</span>. Útil em repos grandes;
                    o scan não para por estimativa de USD.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-base-content/55">
              <HugeiconsIcon icon={DollarCircleIcon} size={14} />
              Prévia do lançamento
            </div>
            <div className="space-y-2 font-mono text-sm">
              <Row k="target" v={repoName} />
              <Row k="model" v={model} />
              <Row k="effort" v={`${effort} / ${mode}`} />
              <Row
                k="teto"
                v={unlimitedCost ? "sem limite" : `US$ ${maxN} (mín. 100)`}
              />
              <Row
                k="escopo"
                v={paths.trim() ? "paths manuais" : "default do CLI"}
              />
            </div>
            <div className="mt-4 rounded-xl bg-base-200/70 px-3.5 py-3">
              <div className="text-[11px] text-base-content/50">Faixa típica (orientação)</div>
              <div className="mt-0.5 font-display text-xl font-bold tabular-nums text-primary">
                ~US$ {hint.typical}
                <span className="text-sm font-normal text-base-content/45"> – {hint.heavy}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-base-content/50">
                {unlimitedCost
                  ? "Sem freio de custo: o scan só para se você cancelar ou se o CLI encerrar."
                  : "Estimativa de tokens. Com assinatura ChatGPT o valor pode não refletir cobrança real — o teto ainda pode parar o scan."}
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3">
              <input
                type="checkbox"
                className="checkbox checkbox-warning checkbox-sm mt-0.5"
                checked={confirmCost}
                onChange={(e) => setConfirmCost(e.target.checked)}
              />
              <span className="text-xs leading-relaxed">
                <span className="mb-0.5 flex items-center gap-1 font-medium">
                  <HugeiconsIcon icon={Alert02Icon} size={13} />
                  Confirmo o risco de custo
                </span>
                Entendo que o scan gera cobrança real e que o limite é uma estimativa com margem.
              </span>
            </label>

            <button
              className="btn btn-primary btn-lg mt-4 w-full gap-2"
              type="submit"
              disabled={
                busy ||
                !confirmCost ||
                (health?.activeScanIds?.length ?? 0) >=
                  (health?.maxConcurrentScans ?? 8)
              }
            >
              {busy ? (
                <span className="loading loading-spinner" />
              ) : (
                <HugeiconsIcon icon={Rocket01Icon} size={18} />
              )}
              {busy
                ? "Iniciando…"
                : `Iniciar · ${model} / ${effort}`}
            </button>
            <p className="mt-2 text-center font-mono text-[11px] text-base-content/45">
              Vai enviar exatamente: {model} · {effort} · {mode}
            </p>
          </section>
        </div>
      </form>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-base-content/40">{k}</span>
      <span className="truncate text-right font-semibold">{v}</span>
    </div>
  );
}
