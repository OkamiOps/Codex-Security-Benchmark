import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Activity01Icon,
  Analytics01Icon,
  DashboardSquare01Icon,
  Menu01Icon,
  Moon02Icon,
  PlusSignIcon,
  SecurityCheckIcon,
  Settings01Icon,
  Shield01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import type { ScanRun } from "@csb/shared";
import { api } from "./api";
import { cx, LiveDuration } from "./components/ui";
import { formatUsd } from "./format";
import { ActivityPage } from "./pages/ActivityPage";
import { ComparePage } from "./pages/ComparePage";
import { DashboardPage } from "./pages/DashboardPage";
import { NewScanPage } from "./pages/NewScanPage";
import { ScanDetailPage } from "./pages/ScanDetailPage";
import { ScansPage } from "./pages/ScansPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useTheme } from "./theme";

const navGroups = [
  {
    label: "Operar",
    items: [
      { to: "/", label: "Dashboard", icon: DashboardSquare01Icon, end: true },
      { to: "/activity", label: "Atividade", icon: Activity01Icon, end: true },
      { to: "/scans", label: "Scans", icon: Shield01Icon, end: true },
      { to: "/scans/new", label: "Novo scan", icon: PlusSignIcon, end: true },
    ],
  },
  {
    label: "Analisar",
    items: [{ to: "/compare", label: "Comparar", icon: Analytics01Icon }],
  },
  {
    label: "Sistema",
    items: [{ to: "/settings", label: "Configurações", icon: Settings01Icon }],
  },
] as const;

export function App() {
  const { isDark, toggle } = useTheme();
  const [activeScans, setActiveScans] = useState<ScanRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const { scans } = await api.listScans();
        if (cancelled) return;
        setActiveScans(scans.filter((s) => s.status === "running"));
      } catch {
        // ignore
      }
    }
    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="drawer lg:drawer-open min-h-screen">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/85 backdrop-blur-md">
          <div className="navbar min-h-14 px-3 sm:px-5">
            <div className="flex-none lg:hidden">
              <label htmlFor="app-drawer" className="btn btn-square btn-ghost btn-sm" aria-label="Menu">
                <HugeiconsIcon icon={Menu01Icon} size={18} />
              </label>
            </div>

            <div className="flex flex-1 items-center gap-3">
              <div className="hidden font-display text-sm font-semibold tracking-tight lg:block">
                Console
              </div>
              {activeScans.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {activeScans.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      to={`/scans/${s.id}`}
                      className="btn btn-ghost btn-sm h-auto min-h-0 gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary hover:bg-primary/15"
                    >
                      <span className="live-dot" />
                      <span className="max-w-[8rem] truncate font-medium">{s.displayName}</span>
                      <LiveDuration
                        startedAt={s.startedAt}
                        status={s.status}
                        durationMs={s.durationMs}
                        className="text-xs"
                        showDot={false}
                      />
                      <span className="font-mono text-xs opacity-80">
                        {formatUsd(s.cost?.estimatedUsd)}
                      </span>
                    </Link>
                  ))}
                  {activeScans.length > 3 && (
                    <Link
                      to="/activity"
                      className="btn btn-ghost btn-xs rounded-full border border-primary/25 text-primary"
                    >
                      +{activeScans.length - 3}
                    </Link>
                  )}
                </div>
              ) : (
                <span className="hidden text-xs text-base-content/45 sm:inline">
                  Nenhum scan em execução
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Link to="/scans/new" className="btn btn-primary btn-sm gap-1.5">
                <HugeiconsIcon icon={PlusSignIcon} size={14} />
                <span className="hidden sm:inline">Novo scan</span>
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-square btn-sm"
                onClick={toggle}
                aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
                title={isDark ? "Modo claro" : "Modo escuro"}
              >
                <HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} size={17} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/scans" element={<ScansPage />} />
            <Route path="/scans/new" element={<NewScanPage />} />
            <Route path="/scans/:id" element={<ScanDetailPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor="app-drawer" className="drawer-overlay" aria-label="Fechar menu" />
        <aside className="flex min-h-full w-[16.5rem] flex-col border-r border-base-300/70 bg-base-100">
          <div className="border-b border-base-300/70 px-5 py-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-content">
              <HugeiconsIcon icon={SecurityCheckIcon} size={18} strokeWidth={1.8} />
            </div>
            <div className="font-display text-[1.05rem] font-bold leading-tight tracking-tight">
              Codex Security
            </div>
            <div className="mt-0.5 text-xs text-base-content/50">Benchmark Console</div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/40">
                  {group.label}
                </div>
                <ul className="menu menu-sm gap-0.5 p-0">
                  {group.items.map((link) => (
                    <li key={link.to}>
                      <NavLink
                        to={link.to}
                        end={"end" in link ? link.end : false}
                        className={({ isActive }) =>
                          cx(
                            "rounded-lg",
                            isActive && "bg-primary/12 font-semibold text-primary",
                          )
                        }
                      >
                        <HugeiconsIcon icon={link.icon} size={17} strokeWidth={1.8} />
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-base-300/70 px-4 py-3 font-mono text-[10px] text-base-content/40">
            local · 127.0.0.1
          </div>
        </aside>
      </div>
    </div>
  );
}
