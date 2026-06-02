import { useEffect, useState } from "react";

const STORAGE_KEY = "source-colors-v1";

// Default hex colors per source (matches the previous Tailwind palette).
export const DEFAULT_SOURCE_COLORS: Record<string, string> = {
  "open-market": "#0ea5e9",
  "off-market": "#8b5cf6",
  rightmove: "#16a34a",
  renoject: "#d946ef",
  auction: "#f43f5e",
  "direct-to-vendor": "#10b981",
  agent: "#f59e0b",
  other: "#71717a",
};

function readStored(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function useSourceColors() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverrides(readStored());
  }, []);

  const setColor = (source: string, color: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [source]: color };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };

  const resetColor = (source: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[source];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const colorFor = (source?: string | null): string | null => {
    if (!source) return null;
    return overrides[source] ?? DEFAULT_SOURCE_COLORS[source] ?? null;
  };

  return { overrides, setColor, resetColor, colorFor };
}

// Convert a hex color to translucent border/bg + readable text styles.
export function badgeStyleFromHex(hex: string | null): React.CSSProperties {
  if (!hex) return {};
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.45)`,
    color: hex,
  };
}