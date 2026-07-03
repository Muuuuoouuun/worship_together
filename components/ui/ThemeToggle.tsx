"use client";

import { Moon, Sun } from 'lucide-react';

type ThemePreference = 'light' | 'dark';

const THEME_STORAGE_KEY = 'worship-theme';

function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
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
            className="tap-target inline-flex items-center justify-center gap-2 rounded-full border border-primary/10 bg-card/80 px-4 py-3 text-sm font-semibold text-primary shadow-sm transition hover:border-primary/20 hover:bg-card motion-safe:active:scale-[0.98]"
        >
            <Moon size={16} className="dark:hidden" />
            <Sun size={16} className="hidden dark:block" />
            <span className="hidden sm:inline">테마</span>
        </button>
    );
}
