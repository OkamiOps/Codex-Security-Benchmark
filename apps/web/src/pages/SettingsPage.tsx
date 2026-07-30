import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Moon02Icon,
  RefreshIcon,
  Settings01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import type { HealthResponse } from "@csb/shared";
import { api } from "../api";
import { AlertBanner, PageHeader, Surface } from "../components/ui";
import { useTheme, type ThemeId } from "../theme";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .health()
      .then(setHealth)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha no health"));
  }, []);

  async function reindex() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.ingest();
      setMessage(`${r.imported} scan(s) indexado(s) do state.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao indexar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Tema, estado do Codex Security e manutenção local deste dashboard."
      />

      {error && <AlertBanner>{error}</AlertBanner>}
      {message && <AlertBanner tone="success">{message}</AlertBanner>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface title="Aparência">
          <div className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-base-content/60">
              Preferência salva neste browser. Também segue o sistema na primeira visita.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "ember" as ThemeId, label: "Escuro", icon: Moon02Icon },
                  { id: "ember-light" as ThemeId, label: "Claro", icon: Sun03Icon },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={`flex items-center gap-3 rounded-box border px-4 py-3 text-left transition ${
                    theme === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-base-300 bg-base-200/40 hover:border-base-content/20"
                  }`}
                >
                  <HugeiconsIcon icon={opt.icon} size={18} />
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Surface>

        <Surface title="Codex Security">
          <div className="space-y-3 p-4 text-sm sm:p-5">
            <Row label="API" value={health?.ok ? "ok" : "—"} />
            <Row label="CLI" value={health?.codexInfo?.cliVersion ?? "—"} mono />
            <Row label="Modelo default" value={health?.codexInfo?.model ?? "—"} mono />
            <Row label="Effort default" value={health?.codexInfo?.reasoningEffort ?? "—"} mono />
            <Row label="State dir" value={health?.codexStateDir ?? "—"} mono />
            <Row
              label="Scans ativos"
              value={
                health?.activeScanIds?.length
                  ? `${health.activeScanIds.length} (${health.activeScanIds.join(", ")})`
                  : "nenhum"
              }
              mono
            />
            <Row
              label="Máx. simultâneos"
              value={String(health?.maxConcurrentScans ?? "—")}
              mono
            />
            <button
              type="button"
              className="btn btn-outline btn-sm mt-2 gap-2"
              disabled={busy}
              onClick={() => void reindex()}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={14}
                className={busy ? "animate-spin" : undefined}
              />
              Reindexar state
            </button>
          </div>
        </Surface>

        <Surface title="Sobre" className="lg:col-span-2">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="rounded-xl bg-base-200 p-2">
              <HugeiconsIcon icon={Settings01Icon} size={18} />
            </div>
            <div className="text-sm leading-relaxed text-base-content/70">
              <p>
                Codex Security Benchmark é um painel local. Credenciais ficam no state oficial do
                Codex Security (`login` no terminal). Este app só lê artefatos e dispara o CLI.
              </p>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-base-content/50">{label}</span>
      <span className={`break-all text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
