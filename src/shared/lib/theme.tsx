/**
 * Giao diện Sáng / Tối / Theo hệ thống. Lưu qua command get_settings/update_settings
 * (key `ui.theme`), đệm trong localStorage để không nháy màu lúc mở app.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/shared/api/commands";
import { useSettings } from "@/shared/api/queries";
import { queryKeys } from "@/shared/api/query-keys";
import type { Theme } from "@/shared/api/types";

const STORAGE_KEY = "qlt.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  /** lựa chọn của người dùng */
  theme: Theme;
  /** giao diện đang áp dụng */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCached(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

function writeCached(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // bỏ qua
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const [theme, setThemeState] = useState<Theme>(readCached);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const savedTheme = settings.data?.theme;
  useEffect(() => {
    if (savedTheme) {
      setThemeState(savedTheme);
      writeCached(savedTheme);
    }
  }, [savedTheme]);

  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      writeCached(next);
      api
        .updateSettings({ theme: next })
        .then((s) => qc.setQueryData(queryKeys.settings, s))
        .catch(() => {
          // Chưa lưu được vào DB thì vẫn giữ lựa chọn cục bộ.
        });
    },
    [qc],
  );

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải nằm trong ThemeProvider");
  return ctx;
}
