import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "ember" | "ember-light";

const STORAGE_KEY = "csb-theme";

interface ThemeContextValue {
  theme: ThemeId;
  isDark: boolean;
  setTheme: (theme: ThemeId) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}

function readInitialTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "ember" || saved === "ember-light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "ember-light"
    : "ember";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "ember";
    const t = readInitialTheme();
    applyTheme(t);
    return t;
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => setThemeState(next), []);
  const toggle = useCallback(() => {
    setThemeState((t) => (t === "ember" ? "ember-light" : "ember"));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "ember",
      setTheme,
      toggle,
    }),
    [theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
