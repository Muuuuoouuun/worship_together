"use client";

import { Moon, Sun } from 'lucide-react';

type ThemePreference = 'light' | 'dark';

const THEME_STORAGE_KEY = 'worship-theme';

function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // The current page can still change theme when browser storage is unavailable.
    }
}

export default function ThemeToggle() {
    return (
        <button
            type="button"
            aria-label="테마 전환"
            onClick={() => {
                const nextTheme: ThemePreference = document.documentElement.classList.contains('dark') ? 'light' : 'dark';

                applyTheme(nextTheme);
            }}
            className="tap-target inline-flex min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
        >
            <Moon size={16} className="dark:hidden" />
            <Sun size={16} className="hidden dark:block" />
            <span className="hidden sm:inline dark:sm:hidden">어둡게</span>
            <span className="hidden dark:sm:inline">밝게</span>
        </button>
    );
}
