import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FsListResponse, HealthResponse } from "@csb/shared";
import { api } from "../api";

const EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;
const MODELS = ["gpt-5.6-sol", "gpt-5.6-terra"] as const;

export function NewScanPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [fs, setFs] = useState<FsListResponse | null>(null);
  const [repositoryPath, setRepositoryPath] = useState("");
  const [model, setModel] = useState<string>("gpt-5.6-sol");
  const [effort, setEffort] = useState<string>("high");
  const [mode, setMode] = useState<"standard" | "deep">("standard");
  const [maxCostUsd, setMaxCostUsd] = useState("25");
  const [paths, setPaths] = useState("");
  const [confirmCost, setConfirmCost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.health().then(setHealth).catch(() => setHealth(null));
    void api
      .listFs()
      .then((r) => {
        setFs(r);
        setRepositoryPath(r.path);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha no browser de pastas"),
      );
  }, []);

  async function openPath(path: string) {
    const r = await api.listFs(path);
    setFs(r);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!repositoryPath.trim()) {
      setError("Informe o caminho do repositório");
      return;
    }
    if (!confirmCost) {
      setError("Confirme que entende o custo estimado antes de iniciar");
      return;
    }
    setBusy(true);
    try {
      const { scan } = await api.startScan({
        repositoryPath: repositoryPath.trim(),
        model,
        effort,
        mode,
        maxCostUsd: maxCostUsd ? Number(maxCostUsd) : undefined,
        paths: paths
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      });
      navigate(`/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Novo scan</h1>
        <p>
          Dispara o Codex Security no repositório escolhido. Default do CLI:{" "}
          <span className="mono">
            {health?.codexInfo?.model ?? "gpt-5.6-sol"} /{" "}
            {health?.codexInfo?.reasoningEffort ?? "xhigh"}
          </span>
          . Scans longos podem custar dezenas de dólares.
        </p>
      </div>

      {health?.activeScanId && (
        <p className="error">
          Já há um scan ativo ({health.activeScanId}). Cancele-o antes de iniciar outro.
        </p>
      )}

      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="repo">Caminho do repositório</label>
          <input
            id="repo"
            value={repositoryPath}
            onChange={(e) => setRepositoryPath(e.target.value)}
            placeholder="/Users/…/meu-repo"
          />
        </div>

        {fs && (
          <div className="browser">
            <div className="browser-path">
              {fs.parent && (
                <button type="button" className="btn" onClick={() => void openPath(fs.parent!)}>
                  ↑
                </button>
              )}
              <span>{fs.path}</span>
              <button
                type="button"
                className="btn"
                onClick={() => setRepositoryPath(fs.path)}
              >
                Usar esta pasta
              </button>
            </div>
            <div className="browser-list">
              {fs.entries
                .filter((e) => e.isDirectory)
                .map((e) => (
                  <button
                    key={e.path}
                    type="button"
                    className="dir"
                    onClick={() => void openPath(e.path)}
                  >
                    {e.name}/
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="model">Modelo</label>
          <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="effort">Effort</label>
          <select id="effort" value={effort} onChange={(e) => setEffort(e.target.value)}>
            {EFFORTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="mode">Mode</label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "standard" | "deep")}
          >
            <option value="standard">standard</option>
            <option value="deep">deep</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="maxCost">Max cost USD (recomendado)</label>
          <input
            id="maxCost"
            type="number"
            min="1"
            step="1"
            value={maxCostUsd}
            onChange={(e) => setMaxCostUsd(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="paths">Paths opcionais (separados por vírgula)</label>
          <input
            id="paths"
            value={paths}
            onChange={(e) => setPaths(e.target.value)}
            placeholder="src, apps/api"
          />
        </div>

        <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={confirmCost}
            onChange={(e) => setConfirmCost(e.target.checked)}
          />
          <span>
            Entendo que o scan pode gerar custo real (o Contion chegou a ~US$ 98) e que o
            limite acima é uma estimativa com margem.
          </span>
        </label>

        {error && <p className="error">{error}</p>}

        <div className="toolbar">
          <button className="btn primary" type="submit" disabled={busy || !!health?.activeScanId}>
            {busy ? "Iniciando…" : "Iniciar scan"}
          </button>
        </div>
      </form>
    </div>
  );
}
