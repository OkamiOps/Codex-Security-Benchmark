import { NavLink, Route, Routes } from "react-router-dom";
import { ComparePage } from "./pages/ComparePage";
import { DashboardPage } from "./pages/DashboardPage";
import { NewScanPage } from "./pages/NewScanPage";
import { ScanDetailPage } from "./pages/ScanDetailPage";
import { ScansPage } from "./pages/ScansPage";

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">Codex Security Benchmark</h1>
        <p className="brand-sub">Scans, custo e comparação modelo×effort</p>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/scans">Scans</NavLink>
          <NavLink to="/scans/new">Novo scan</NavLink>
          <NavLink to="/compare">Comparar</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/scans" element={<ScansPage />} />
          <Route path="/scans/new" element={<NewScanPage />} />
          <Route path="/scans/:id" element={<ScanDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </main>
    </div>
  );
}
