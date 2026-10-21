'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
    CHART_MAX_CAPO,
    CHART_SOURCE_MAX,
    chartKeyLine,
    guessChartKey,
    parseChordChart,
    type ChartChordsAs,
    type ChartMode,
    type ChartSettings,
} from '@/lib/chordChart';
import { HYMN_EXAMPLE } from '@/lib/chordChartExample';
import { keyLabel, LEAD_SHEET_KEYS, type LeadSheetKey } from '@/lib/leadSheet';

type Props = {
    /** The chart already in the draft, if any; making a chart again redraws its pages and keeps the marks. */
    initial: ChartSettings | null;
    busy: boolean;
    onCreate: (settings: ChartSettings) => void;
    onClose: () => void;
};

const field = 'tap-target rounded-xl border border-primary/15 bg-background/80 px-3 py-2 text-sm font-bold disabled:opacity-40';
const choice = 'tap-target rounded-xl border border-primary/15 px-3 py-2 text-sm font-semibold disabled:opacity-40 aria-pressed:bg-primary aria-pressed:text-primary-foreground';

/**
 * Text editor for a chord chart (코드 악보) plus how to show it: key, capo, chords or lyrics only, concert
 * chords or capo shapes. A choice left alone follows the text: 원키 from {key:} or the first chord, the
 * key from 원키, the capo from {capo:}.
 */
export default function ChordChartPanel({ initial, busy, onCreate, onClose }: Props) {
    const [source, setSource] = useState(initial?.source ?? '');
    const [originalChoice, setOriginalChoice] = useState<LeadSheetKey | null>(initial?.originalKey ?? null);
    const [keyChoice, setKeyChoice] = useState<LeadSheetKey | null>(initial?.key ?? null);
    const [capoChoice, setCapoChoice] = useState<number | null>(initial?.capo ?? null);
    const [mode, setMode] = useState<ChartMode>(initial?.mode ?? 'chords');
    const [chordsAs, setChordsAs] = useState<ChartChordsAs>(initial?.chordsAs ?? 'concert');

    const chart = useMemo(() => parseChordChart(source), [source]);
    const originalKey = originalChoice ?? guessChartKey(chart) ?? 'C';
    const key = keyChoice ?? originalKey;
    const capo = capoChoice ?? chart.capo ?? 0;
    const settings: ChartSettings = { source, key, originalKey, capo, mode, chordsAs };
    const lineCount = chart.sections.reduce((sum, section) => sum + section.lines.filter((line) => line.length).length, 0);
    const chordCount = chart.sections.reduce((sum, section) => sum + section.lines.flat().filter((segment) => segment.chord).length, 0);
    const tooLong = source.length > CHART_SOURCE_MAX;

    function loadExample() {
        setSource(HYMN_EXAMPLE);
        setOriginalChoice(null);
        setKeyChoice(null);
        setCapoChoice(null);
    }

    return (
        <div className="space-y-3 rounded-2xl border border-primary/10 bg-card/40 p-3 animate-in fade-in duration-150" role="group" aria-label="코드 악보 만들기">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold">코드 악보 만들기</h4>
                <button type="button" aria-label="코드 악보 만들기 닫기" className="tap-target rounded-lg p-1 text-muted-foreground hover:text-foreground" onClick={onClose}>
                    <X size={16} />
                </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
                코드는 가사 앞에 [G]주의 [D/F#]은혜 처럼 대괄호로 적습니다. 줄에 [Verse 1]·[후렴]만 있거나 # 후렴, {'{c: Chorus}'}로 쓰면 섹션이 됩니다.
                {' {title: } {key: G} {capo: 2} {tempo: 72}'}도 쓸 수 있습니다. 코드는 원키 기준으로 적고, 아래에서 키와 카포를 바꿉니다.
            </p>
            <textarea
                aria-label="코드 악보 텍스트"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                rows={12}
                spellCheck={false}
                placeholder={'[Verse 1]\n[G]주의 [D/F#]은혜 [Em]놀라워\n\n# 후렴\n[C]주님 [G]사랑'}
                className="w-full rounded-xl border border-primary/15 bg-background/80 p-3 font-mono text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    원키
                    <select aria-label="입력한 코드의 원키" className={field} value={originalKey} onChange={(e) => setOriginalChoice(e.target.value as LeadSheetKey)}>
                        {LEAD_SHEET_KEYS.map((item) => (
                            <option key={item} value={item}>
                                {keyLabel(item)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    키
                    <select aria-label="코드 악보 키" className={field} value={key} onChange={(e) => setKeyChoice(e.target.value as LeadSheetKey)}>
                        {LEAD_SHEET_KEYS.map((item) => (
                            <option key={item} value={item}>
                                {keyLabel(item)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    카포
                    <select aria-label="카포" className={field} value={capo} disabled={mode === 'lyrics'} onChange={(e) => setCapoChoice(Number(e.target.value))}>
                        {Array.from({ length: CHART_MAX_CAPO + 1 }, (_, fret) => (
                            <option key={fret} value={fret}>
                                {fret === 0 ? '없음' : `${fret}프렛`}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5" role="group" aria-label="악보 보기 방식">
                    <button type="button" className={choice} aria-pressed={mode === 'chords'} onClick={() => setMode('chords')}>
                        코드 + 가사
                    </button>
                    <button type="button" className={choice} aria-pressed={mode === 'lyrics'} onClick={() => setMode('lyrics')}>
                        가사만
                    </button>
                </div>
                <div className="flex gap-1.5" role="group" aria-label="코드 표기 방식">
                    <button type="button" className={choice} aria-pressed={chordsAs === 'concert'} disabled={mode === 'lyrics'} onClick={() => setChordsAs('concert')}>
                        실제 코드
                    </button>
                    <button type="button" className={choice} aria-pressed={chordsAs === 'capo'} disabled={mode === 'lyrics'} onClick={() => setChordsAs('capo')}>
                        카포 코드 폼
                    </button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{chartKeyLine(settings)}</span> · 섹션 {chart.sections.filter((section) => section.name).length}개 · {lineCount}줄 · 코드 {chordCount}개
                {tooLong && <span className="font-bold text-red-600"> · 글이 너무 깁니다 (최대 {CHART_SOURCE_MAX.toLocaleString()}자)</span>}
                {initial && ' · 이미 있는 코드 악보 페이지는 새로 그려지고 필기는 그대로 남습니다'}
            </p>
            <div className="flex flex-wrap gap-2">
                <button type="button" className={`${choice} border-amber-400/40 bg-amber-400/10`} disabled={busy} onClick={loadExample}>
                    예시 불러오기 (나 같은 죄인 살리신)
                </button>
                <button
                    type="button"
                    className={`${choice} bg-primary text-primary-foreground`}
                    disabled={busy || !source.trim() || tooLong}
                    onClick={() => onCreate(settings)}
                >
                    코드 악보 만들기
                </button>
            </div>
        </div>
    );
}
