'use client';

import { PART_ALL_LABEL, PART_BADGES, PART_LABELS, SHEET_PARTS, togglePartInSelection, type SheetPart } from '@/lib/markParts';

const chip =
    'inline-flex min-h-8 items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-bold transition hover:bg-muted/80 aria-pressed:bg-primary aria-pressed:text-primary-foreground';

const PartDot = ({ part }: { part: SheetPart }) => (
    <span className="size-2 shrink-0 rounded-full ring-1 ring-white/60" style={{ backgroundColor: PART_BADGES[part].color }} aria-hidden />
);

type PickerProps = {
    /** null = everyone (모두). */
    value: SheetPart | null;
    onChange: (part: SheetPart | null) => void;
};

/** 누구에게: who the next marks are for. Pen, highlighter, stamp, text, box and line all carry it. */
export default function MarkPartPicker({ value, onChange }: PickerProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="필기 대상 파트">
            <span className="font-medium text-muted-foreground">누구에게:</span>
            <button type="button" aria-pressed={value === null} title="모든 파트가 보는 필기" onClick={() => onChange(null)} className={chip}>
                {PART_ALL_LABEL}
            </button>
            {SHEET_PARTS.map((part) => (
                <button
                    key={part}
                    type="button"
                    aria-pressed={value === part}
                    aria-label={`${PART_LABELS[part]} 파트용 필기`}
                    title={`${PART_LABELS[part]} 파트 연주자에게만 보이는 필기`}
                    onClick={() => onChange(part)}
                    className={chip}
                >
                    <PartDot part={part} />
                    {PART_LABELS[part]}
                </button>
            ))}
        </div>
    );
}

type FilterProps = {
    /** null = every part shows. Otherwise marks for everyone plus these parts. */
    visible: ReadonlySet<SheetPart> | null;
    onChange: (visible: ReadonlySet<SheetPart> | null) => void;
    /** Marks hidden on the page on screen, so a missing mark is never a mystery. */
    hiddenCount?: number;
};

/** 보기: a per-device filter of which parts' marks to show (marks for everyone always show). */
export function MarkPartFilter({ visible, onChange, hiddenCount = 0 }: FilterProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="파트별 필기 보기">
            <span className="font-bold text-muted-foreground">보기</span>
            <button type="button" aria-pressed={visible === null} title="모든 파트의 필기를 봅니다" onClick={() => onChange(null)} className={chip}>
                전체
            </button>
            {SHEET_PARTS.map((part) => (
                <button
                    key={part}
                    type="button"
                    aria-pressed={visible?.has(part) ?? false}
                    aria-label={`${PART_LABELS[part]} 필기 보기`}
                    title={`${PART_LABELS[part]} 필기도 함께 봅니다`}
                    onClick={() => onChange(togglePartInSelection(visible, part))}
                    className={chip}
                >
                    <PartDot part={part} />
                    {PART_LABELS[part]}
                </button>
            ))}
            <span className="text-muted-foreground" aria-live="polite">
                {visible ? `${PART_ALL_LABEL} 필기와 고른 파트만 표시${hiddenCount ? ` · 이 페이지 ${hiddenCount}개 숨김` : ''}` : '이 기기에서만 적용됩니다'}
            </span>
        </div>
    );
}
