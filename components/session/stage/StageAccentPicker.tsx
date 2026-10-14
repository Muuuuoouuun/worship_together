"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
import { getStageAccentTheme, STAGE_ACCENT_PRESETS } from '@/lib/stageAccent';

interface StageAccentPickerProps {
    accent: string;
    isDefault: boolean;
    onChange: (value: string | null) => void;
}

export default function StageAccentPicker({ accent, isDefault, onChange }: StageAccentPickerProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const panelId = useId();
    const shownAccent = getStageAccentTheme(accent).accent;
    const adjusted = shownAccent !== accent;

    useEffect(() => {
        if (!open) return;
        const handlePointer = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('pointerdown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label="강조색 바꾸기"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((value) => !value)}
                className="tap-target relative inline-flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[#FFF7E8] transition hover:bg-white/10"
            >
                <Palette size={18} aria-hidden="true" />
                <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full border border-[#070D0C] bg-(--stage-accent)" />
            </button>

            {open ? (
                <div
                    id={panelId}
                    role="dialog"
                    aria-label="강조색"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-[#0D1513] p-4 text-[#FFF7E8] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
                >
                    <p className="text-sm font-bold">강조색</p>
                    <p className="mt-1 text-xs text-white/65">이 기기의 예배 무대 화면에만 저장돼요.</p>

                    <div className="mt-3 grid grid-cols-4 gap-2">
                        {STAGE_ACCENT_PRESETS.map((preset, index) => {
                            const selected = preset.hex === accent;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => onChange(index === 0 ? null : preset.hex)}
                                    className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border transition ${selected ? 'border-white/40 bg-white/[0.08]' : 'border-transparent hover:bg-white/[0.06]'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="flex size-8 items-center justify-center rounded-full text-[#0B1211]"
                                        style={{ background: preset.hex }}
                                    >
                                        {selected ? <Check size={16} strokeWidth={3} /> : null}
                                    </span>
                                    <span className="text-[11px] font-semibold text-white/80">{preset.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/12 px-3 text-sm font-semibold">
                        직접 고르기
                        <input
                            type="color"
                            value={accent.toLowerCase()}
                            onChange={(event) => onChange(event.target.value)}
                            className="h-8 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                        />
                    </label>
                    {adjusted ? (
                        <p className="mt-2 text-xs text-white/65">
                            어두운 색은 무대에서 잘 보이도록 조금 밝혀서 표시돼요.
                        </p>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        disabled={isDefault}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                    >
                        <RotateCcw size={14} aria-hidden="true" />
                        기본 앰버로 되돌리기
                    </button>
                </div>
            ) : null}
        </div>
    );
}
