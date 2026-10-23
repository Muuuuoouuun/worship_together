'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ChevronUp, Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import TimeLeft from './TimeLeft';
import { useOutsideClose } from './hooks';
import { formatElapsed, useNow } from './time';
import type { LiveConnection, LiveToast, LiveToastKind, LiveToastUrgency } from './model';

/*
 * 위 가운데 큐 아일랜드 — 연주 큐(받은 큐 · 보낸 큐)만 여기에 뜹니다.
 * 급한 받은 큐는 크게 펼쳤다가 작은 알약으로 접히고, 여러 개면 +N. 큐가 없으면 조용한 '진행 중 · 경과 시간'.
 * 화면을 잠가도 큐는 확인할 수 있게, 아일랜드는 잠그지 않는 자리에 둡니다.
 */

export type IslandMode = 'idle' | 'compact' | 'medium' | 'large' | 'list';

/** 펼친 아일랜드가 다시 작은 알약으로 접히기까지 */
const EXPAND_MS: Record<LiveToastUrgency, number> = { high: 3200, normal: 2400, low: 2000 };

export const CUE_KIND_LABEL: Partial<Record<LiveToastKind, string>> = {
    'cue-all': '전체 신호',
    'cue-role': '파트 신호',
    'cue-sent': '보낸 신호',
};

function sendPath(toast: LiveToast) {
    if (toast.from && toast.target) return `${toast.from} → ${toast.target}`;
    return toast.from ?? toast.target ?? '';
}

/**
 * @param modeClassName 모드별 자리 · 너비를 바꿀 때 (데스크톱은 위 막대가 아니라 악보 · 펄스 열 맨 위 줄에 섭니다)
 */
export default function CueIsland({
    cues,
    desktop,
    connection,
    startedAt,
    onAck,
    onDismiss,
    modeClassName,
}: {
    cues: LiveToast[];
    desktop: boolean;
    connection: LiveConnection;
    startedAt: string;
    onAck: (id: string) => void;
    onDismiss: (id: string) => void;
    modeClassName?: Partial<Record<IslandMode, string>>;
}) {
    const [known, setKnown] = useState('');
    const [focusId, setFocusId] = useState<string | null>(null);
    const [listOpen, setListOpen] = useState(false);
    const swipeStart = useRef<number | null>(null);

    // 새로 온 받은 큐는 크게 펼칩니다 (렌더 중 상태 맞추기 — 효과 대신)
    const idsKey = cues.map((cue) => cue.id).join(' ');
    if (idsKey !== known) {
        const before = new Set(known.split(' '));
        const fresh = cues.find((cue) => !before.has(cue.id) && cue.urgency !== 'low' && cue.ackable && !cue.acked);
        setKnown(idsKey);
        if (fresh) {
            setFocusId(fresh.id);
            setListOpen(false);
        }
        if (cues.length < 2) setListOpen(false);
    }

    const focused = focusId ? cues.find((cue) => cue.id === focusId) ?? null : null;
    const mode: IslandMode = cues.length === 0 ? 'idle' : listOpen && cues.length > 1 ? 'list' : focused ? (focused.urgency === 'high' ? 'large' : 'medium') : 'compact';
    const focusedUrgency = focused?.urgency;
    const wrap = useOutsideClose(mode === 'list', () => setListOpen(false));

    // 펼친 큐는 잠시 뒤 작은 알약으로 접힙니다. 마우스가 올라가 있거나 키보드 포커스가 안에 있으면 그동안만 기다립니다.
    useEffect(() => {
        if (!focusId || !focusedUrgency) return;
        let timer: ReturnType<typeof setTimeout>;
        const fold = () => {
            const node = wrap.current;
            const hovered = node !== null && window.matchMedia('(hover: hover)').matches && node.matches(':hover');
            const keyboard = node !== null && node.querySelector(':focus-visible') !== null;
            if (hovered || keyboard) timer = setTimeout(fold, 600);
            else setFocusId(null);
        };
        timer = setTimeout(fold, EXPAND_MS[focusedUrgency]);
        return () => clearTimeout(timer);
    }, [focusId, focusedUrgency, wrap]);

    useEffect(() => {
        if (mode !== 'list' && mode !== 'large' && mode !== 'medium') return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setListOpen(false);
            setFocusId(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [mode]);

    function collapse() {
        setListOpen(false);
        setFocusId(null);
    }

    // 펼친 아일랜드를 위로 밀면 접힙니다
    const swipe = {
        onPointerDown: (event: ReactPointerEvent) => {
            swipeStart.current = event.clientY;
        },
        onPointerUp: (event: ReactPointerEvent) => {
            if (swipeStart.current !== null && event.clientY - swipeStart.current < -28) collapse();
            swipeStart.current = null;
        },
        onPointerCancel: () => {
            swipeStart.current = null;
        },
    };

    // 접힌 알약의 얼굴: 아직 확인 안 한 받은 큐(급한 것 먼저)가 있으면 그 큐 — 바로 '확인'을 누를 수 있게. 없으면 가장 새 큐.
    const pending = cues.filter((cue) => cue.ackable && !cue.acked);
    const face = pending.find((cue) => cue.urgency === 'high') ?? pending[0] ?? cues[0];
    const more = cues.length - 1;
    const hiddenUnacked = pending.some((cue) => cue !== face);

    return (
        <div
            ref={wrap}
            data-island={mode}
            data-island-open={mode === 'medium' || mode === 'large' || mode === 'list' ? '' : undefined}
            className={cn(
                'absolute left-1/2 top-1.5 z-10 -translate-x-1/2',
                mode === 'idle' && 'top-1/2 -translate-y-1/2',
                mode === 'compact' && (desktop ? 'top-3 max-w-[min(480px,calc(100%-720px))]' : 'max-w-[calc(100%-112px)]'),
                (mode === 'medium' || mode === 'list') && (desktop ? 'top-3 w-[440px]' : 'w-[calc(100%-8px)] max-w-[400px]'),
                mode === 'large' && (desktop ? 'top-3 w-[480px]' : 'w-[calc(100%-8px)] max-w-[400px]'),
                modeClassName?.[mode],
            )}
        >
            {mode === 'idle' ? <IdleStatus connection={connection} startedAt={startedAt} /> : null}

            {mode === 'compact' && face ? (
                <div
                    key={face.id}
                    className={cn(
                        'flex items-center gap-1 rounded-full bg-primary p-1 text-primary-foreground shadow-lg shadow-foreground/15 animate-in fade-in duration-200 motion-reduce:animate-none',
                        desktop ? 'h-11' : 'h-10',
                    )}
                >
                    <button
                        type="button"
                        aria-expanded={false}
                        onClick={() => (more > 0 ? setListOpen(true) : setFocusId(face.id))}
                        className="relative flex h-full min-w-0 items-center gap-2 rounded-full pl-2.5 pr-2 outline-none after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                    >
                        <CueLead cue={face} />
                        <span className={cn('min-w-0 max-w-40 shrink truncate font-semibold', desktop ? 'text-sm' : 'text-[13px]')}>{face.title}</span>
                        {face.progress ? (
                            <span className="shrink-0 text-xs tabular-nums text-primary-foreground/80">
                                {face.progress.done}/{face.progress.total}
                            </span>
                        ) : face.from && (desktop || more === 0 || !face.ackable || face.acked) ? (
                            <span className={cn('min-w-0 truncate text-primary-foreground/80', desktop ? 'text-sm' : 'text-[13px]')}>{face.from}</span>
                        ) : null}
                        {more > 0 ? (
                            <span className="relative ml-0.5 inline-flex h-5 shrink-0 items-center rounded-full bg-primary-foreground/15 px-1.5 text-[11px] font-semibold tabular-nums">
                                +{more}
                                {hiddenUnacked ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-secondary ring-2 ring-primary" /> : null}
                            </span>
                        ) : null}
                        <span className="sr-only">{more > 0 ? ' 신호 모두 보기' : ' 신호 펼치기'}</span>
                    </button>
                    {face.ackable ? <AckButton cue={face} onAck={onAck} size="xs" /> : null}
                </div>
            ) : null}

            {mode === 'medium' && focused ? (
                <div
                    key={focused.id}
                    {...swipe}
                    className="relative flex h-16 items-center gap-3 overflow-hidden rounded-2xl bg-primary pl-5 pr-2 text-primary-foreground shadow-xl shadow-foreground/20 animate-in fade-in duration-300 motion-reduce:animate-none"
                >
                    <CueLead cue={focused} />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold leading-tight">{focused.title}</p>
                        <p className="truncate text-xs text-primary-foreground/80">
                            {CUE_KIND_LABEL[focused.kind]} · {sendPath(focused)}
                        </p>
                    </div>
                    {focused.ackable ? <AckButton cue={focused} onAck={onAck} size="sm" /> : <SentProgress cue={focused} />}
                    <IslandClose cue={focused} onDismiss={onDismiss} />
                    <TimeLeft toast={focused} className="inset-x-8 bottom-1 bg-primary-foreground/25" />
                </div>
            ) : null}

            {mode === 'large' && focused ? (
                <div
                    key={focused.id}
                    {...swipe}
                    className="relative overflow-hidden rounded-2xl bg-primary px-5 pb-5 pt-3 text-primary-foreground shadow-2xl shadow-foreground/25 animate-in fade-in duration-300 motion-reduce:animate-none"
                >
                    <div className="flex items-center gap-2 text-[13px] text-primary-foreground/80">
                        {!focused.acked ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-secondary" /> : null}
                        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
                        <span className="shrink-0 font-medium text-primary-foreground">{CUE_KIND_LABEL[focused.kind]}</span>
                        <span className="truncate">{sendPath(focused)}</span>
                        <IslandClose cue={focused} onDismiss={onDismiss} className="-mr-2 ml-auto" />
                    </div>
                    <div className="mt-1 flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className={cn('truncate font-semibold leading-tight tracking-tight', desktop ? 'text-[40px]' : 'text-[32px]')}>{focused.title}</p>
                            {focused.body ? <p className="mt-0.5 truncate text-[15px] text-primary-foreground/70">{focused.body}</p> : null}
                        </div>
                        {focused.ackable ? <AckButton cue={focused} onAck={onAck} size="lg" /> : <SentProgress cue={focused} />}
                    </div>
                    <TimeLeft toast={focused} className="inset-x-6 bottom-2 bg-primary-foreground/25" />
                </div>
            ) : null}

            {mode === 'list' ? (
                <div
                    {...swipe}
                    className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-2xl shadow-foreground/25 animate-in fade-in duration-200 motion-reduce:animate-none"
                >
                    <div className="flex items-center justify-between pl-3">
                        <p className="text-[13px] font-medium text-primary-foreground/80">
                            큐 <span className="tabular-nums">{cues.length}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setListOpen(false)}
                            className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-primary-foreground/80 outline-none hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                        >
                            접기
                            <ChevronUp className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <ul className="divide-y divide-primary-foreground/10">
                        {cues.map((cue) => (
                            <li key={cue.id} className="flex min-h-16 items-center gap-3 py-2 pl-3">
                                <CueLead cue={cue} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] font-semibold leading-snug">{cue.title}</p>
                                    <p className="truncate text-xs text-primary-foreground/80">
                                        {CUE_KIND_LABEL[cue.kind]} · {sendPath(cue)}
                                    </p>
                                </div>
                                {cue.ackable ? <AckButton cue={cue} onAck={onAck} size="sm" /> : <SentProgress cue={cue} />}
                                <IslandClose cue={cue} onDismiss={onDismiss} />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

/** 아일랜드 앞 표시: 확인 안 한 받은 큐 = 주황 점, 확인함 · 보낸 큐 = 체크 */
function CueLead({ cue }: { cue: LiveToast }) {
    if (cue.ackable && !cue.acked) {
        return (
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <span className="relative flex size-2">
                    {cue.urgency === 'high' ? <span className="absolute inset-0 rounded-full bg-secondary opacity-60 motion-safe:animate-ping" /> : null}
                    <span className="relative size-2 rounded-full bg-secondary" />
                </span>
            </span>
        );
    }
    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
            <Check className="size-3" strokeWidth={3} />
        </span>
    );
}

function AckButton({ cue, onAck, size }: { cue: LiveToast; onAck: (id: string) => void; size: 'xs' | 'sm' | 'lg' }) {
    const box = size === 'lg' ? 'h-14 min-w-24 px-6 text-base' : size === 'sm' ? 'h-11 px-4 text-sm' : 'h-8 px-3 text-xs';
    if (cue.acked) {
        return (
            <span className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary-foreground/15 font-semibold text-primary-foreground animate-in fade-in duration-150 motion-reduce:animate-none', box)}>
                <Check className={size === 'lg' ? 'size-5' : 'size-3.5'} aria-hidden="true" />
                확인함
            </span>
        );
    }
    return (
        <button
            type="button"
            onClick={() => onAck(cue.id)}
            aria-label={`${cue.title} 큐 확인`}
            className={cn(
                // 작은 확인(32px)도 누르는 자리는 위아래로 넓혀 44px 에 가깝게
                'relative inline-flex shrink-0 items-center justify-center rounded-full bg-primary-foreground font-semibold text-primary outline-none transition-transform after:absolute after:-inset-y-1.5 after:-inset-x-1 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary-foreground/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary motion-reduce:transform-none',
                box,
            )}
        >
            확인
        </button>
    );
}

/** 보낸 큐: 몇 명이 확인했는지 작은 원 + 숫자 */
function SentProgress({ cue }: { cue: LiveToast }) {
    if (!cue.progress) return null;
    const { done, total } = cue.progress;
    const ratio = total > 0 ? Math.min(1, done / total) : 0;
    return (
        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs tabular-nums text-primary-foreground/70" role="img" aria-label={`${total}명 중 ${done}명 확인`}>
            <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-primary-foreground/20" />
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" strokeLinecap="round" pathLength={100} strokeDasharray={`${ratio * 100} 100`} className="stroke-primary-foreground" />
            </svg>
            <span aria-hidden="true">
                {done}/{total}
            </span>
        </span>
    );
}

function IslandClose({ cue, onDismiss, className }: { cue: LiveToast; onDismiss: (id: string) => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={() => onDismiss(cue.id)}
            aria-label={`${cue.title} 알림 닫기`}
            className={cn(
                'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground/80 outline-none transition-colors after:absolute after:-inset-1 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/70',
                className,
            )}
        >
            <X className="size-4" aria-hidden="true" />
        </button>
    );
}

/** 알림이 없을 때 아일랜드 자리: 조용한 '진행 중 · 경과 시간' (연결이 끊기면 '다시 연결 중') */
function IdleStatus({ connection, startedAt }: { connection: LiveConnection; startedAt: string }) {
    const now = useNow(1000);
    const elapsed = formatElapsed(startedAt, now);
    const warn = connection !== 'online';
    const label = connection === 'offline' ? '다시 연결 중' : connection === 'connecting' ? '연결 중' : '진행 중';
    return (
        <p className="flex h-9 items-center gap-1.5 whitespace-nowrap px-3 text-xs text-muted-foreground animate-in fade-in duration-300 motion-reduce:animate-none">
            <span className="relative flex size-1.5" aria-hidden="true">
                <span className={cn('relative size-1.5 rounded-full', warn ? 'bg-warning' : 'bg-brand')} />
            </span>
            <span className={cn('font-medium', warn ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            {elapsed ? (
                <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                        <span className="sr-only">경과 </span>
                        {elapsed}
                    </span>
                </>
            ) : null}
        </p>
    );
}
