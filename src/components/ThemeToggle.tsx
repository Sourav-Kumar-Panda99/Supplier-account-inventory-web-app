"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";

/** Must match the key read by the inline script in app/layout.tsx. */
export const THEME_STORAGE_KEY = "theme";

type Theme = "light" | "dark";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // storage blocked (private mode, strict settings) — just follow the device
  }
}

/**
 * Keeps <html data-theme> in step with the saved choice. The inline script in
 * app/layout.tsx already sets it before first paint; this re-applies it in
 * development, where React's Strict Mode remount resets <html> to the
 * attributes it knows from JSX. Rendered once, in the root layout.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const theme = storedTheme();
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}

/**
 * Switches between the light and dark theme and remembers the choice in this
 * browser. Until someone presses it, the app follows the device's setting.
 *
 * There is deliberately no React state here: which icon shows is decided in
 * CSS from <html data-theme> (see globals.css), so the server-rendered button
 * is already correct and can never disagree with the page around it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const current: Theme =
      (root.getAttribute("data-theme") as Theme | null) ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next: Theme = current === "dark" ? "light" : "dark";

    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Still switches for this page view; it just won't be remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch between light and dark theme"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)] ${className ?? ""}`}
      style={{ color: "var(--muted)" }}
    >
      <Moon size={18} strokeWidth={2} className="theme-icon-moon" aria-hidden />
      <Sun size={18} strokeWidth={2} className="theme-icon-sun" aria-hidden />
    </button>
  );
}
