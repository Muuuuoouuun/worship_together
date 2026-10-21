'use client';

import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Bell, Check, ChevronDown, CircleAlert, Wifi, WifiOff, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar } from '@/components/conti/ui';
import TimeLeft from './TimeLeft';
import { useOutsideClose } from './hooks';
import type { LiveToast, LiveToastKind } from './model';

/*
 * 앱 알림 카드 줄 — 연결 · 저장 · 오류 · 팀 소식. 넘김 버튼 바로 위에서 열리고, 여러 개면 뒤 카드가 살짝 겹쳐 보입니다.
 * 버튼을 가리지 않고 가운데가 그만큼 비켜 줍니다 (DockZone).
 */

/** 앱 알림의 아이콘 · 색. 끈질긴 알림(연결 끊김 · 오류)은 토큰 색 테두리와 아이콘으로 구분합니다. */
const NOTICE_LOOK: Partial<Record<LiveToastKind, { icon: LucideIcon; tile: string; ring: string }>> = {
    offline: { icon: WifiOff, tile: 'bg-warning/10 text-warning', ring: 'ring-warning/40' },
    online: { icon: Wifi, tile: 'bg-success/10 text-success', ring: 'ring-border' },
    saved: { icon: Check, tile: 'bg-muted text-foreground', ring: 'ring-border' },
    error: { icon: CircleAlert, tile: 'bg-destructive/10 text-destructive', ring: 'ring-destructive/40' },
    team: { icon: Bell, tile: 'bg-muted text-foreground', ring: 'ring-border' },
};

export default function NoticeDock({ notices, desktop, onAction, onDismiss }: { notices: LiveToast[]; desktop: boolean; onAction: (id: string) => void; onDismiss: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const many = notices.length > 1;
    const expanded = open && many;
    const wrap = useOutsideClose(expanded && !desktop, () => setOpen(false));

    if (notices.length === 0) return null;

    const hover = desktop
        ? {
              onPointerEnter: () => setOpen(true),
              onPointerLeave: () => setOpen(false),
          }
        : {};

    const front = notices[0];
    return (
        <div ref={wrap} {...hover}>
            {/* 접힌 더미: 가장 새 알림이 앞, 뒤 알림은 위로 살짝 보이는 판. 펼친 동안에도 자리를 지켜 높이가 흔들리지 않습니다 */}
            <div key={front.id} inert={expanded} className={cn('relative', notices.length > 2 ? 'mt-3' : many ? 'mt-1.5' : '', expanded && 'invisible')}>
                {notices.slice(1, 3).map((notice, index) => (
                    <span
                        key={notice.id}
                        aria-hidden="true"
                        className={cn(
                            'absolute rounded-2xl bg-card shadow-md shadow-foreground/5 ring-1',
                            NOTICE_LOOK[notice.kind]?.ring ?? 'ring-border',
                            index === 0 ? 'inset-x-3 -top-1.5 bottom-1.5' : 'inset-x-6 -top-3 bottom-3',
                        )}
                    />
                ))}
                <NoticeCard notice={front} count={notices.length} onExpand={many ? () => setOpen(true) : undefined} onAction={onAction} onDismiss={onDismiss} />
            </div>

            {expanded ? (
                // 펼치면 한 장의 판 위로 늘어납니다. 가장 새 알림은 처음 뜬 자리(맨 아래)에 그대로 남습니다.
                <div className="absolute -inset-x-1.5 -bottom-1.5 rounded-[28px] bg-background p-1.5 shadow-2xl shadow-foreground/15 ring-1 ring-border animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
                    <div className="flex items-center justify-between pl-3">
                        <p className="text-[13px] font-medium text-muted-foreground">
                            앱 알림 <span className="tabular-nums">{notices.length}</span>
                        </p>
                        <button type="button" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-10 gap-1 px-3 text-[13px] text-muted-foreground')}>
                            접기
                            <ChevronDown className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-1.5">
                        {[...notices].reverse().map((notice) => (
                            <NoticeCard key={notice.id} notice={notice} flat onAction={onAction} onDismiss={onDismiss} />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function NoticeCard({
    notice,
    count = 1,
    flat = false,
    onExpand,
    onAction,
    onDismiss,
}: {
    notice: LiveToast;
    count?: number;
    /** 펼친 판 안에서는 그림자 없이 */
    flat?: boolean;
    onExpand?: () => void;
    onAction: (id: string) => void;
    onDismiss: (id: string) => void;
}) {
    const swipe = useSwipeDismiss(() => onDismiss(notice.id));
    const look = NOTICE_LOOK[notice.kind];
    const Icon = look?.icon;

    const text = (
        <>
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{notice.title}</span>
            {notice.body ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notice.body}</span> : null}
        </>
    );

    return (
        <div
            {...swipe.bind}
            style={swipe.style}
            className={cn(
                'relative flex min-h-16 touch-pan-y select-none items-center gap-3 rounded-2xl bg-card py-2.5 pl-3 pr-1.5 text-card-foreground ring-1 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none',
                !flat && 'shadow-lg shadow-foreground/10',
                look?.ring ?? 'ring-border',
            )}
        >
            <span className="relative shrink-0">
                {notice.kind === 'team' && notice.from ? (
                    <Avatar name={notice.from} size="md" />
                ) : Icon ? (
                    <span className={cn('flex size-9 items-center justify-center rounded-full', look.tile)}>
                        <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                ) : null}
                {count > 1 ? (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-card">
                        +{count - 1}
                    </span>
                ) : null}
            </span>

            {onExpand ? (
                <button
                    type="button"
                    onClick={onExpand}
                    aria-label={`앱 알림 ${count}개 모두 보기 — ${notice.title}`}
                    className="min-h-11 min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    {text}
                </button>
            ) : (
                <p className="min-w-0 flex-1">{text}</p>
            )}

            {notice.action ? (
                <button
                    type="button"
                    data-no-swipe
                    onClick={() => onAction(notice.id)}
                    className={cn(buttonVariants({ variant: notice.kind === 'error' ? 'default' : 'secondary', size: 'sm' }), 'h-11 shrink-0 px-3.5 text-[13px]')}
                >
                    {notice.action}
                </button>
            ) : null}
            <button
                type="button"
                data-no-swipe
                onClick={() => onDismiss(notice.id)}
                aria-label={`${notice.title} 알림 닫기`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0 text-muted-foreground')}
            >
                <X className="size-4" aria-hidden="true" />
            </button>
            {notice.ttl === null ? null : <TimeLeft toast={notice} className="inset-x-5 bottom-0 bg-foreground/20" />}
        </div>
    );
}

/** 앱 알림 줄. 알림이 있을 때만 열리고(높이 0 → 내용), 그동안 위의 가운데가 조금 작아집니다. */
export function DockZone({ open, desktop, children }: { open: boolean; desktop: boolean; children: ReactNode }) {
    return (
        <div className={cn('relative z-20 grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="flex min-h-0 flex-col justify-end">
                <div className={cn(desktop ? 'mx-auto w-full max-w-[460px] px-6 pb-3' : 'px-3 pt-3')}>
                    <div className="relative">{children}</div>
                </div>
            </div>
        </div>
    );
}

/** 옆으로 밀어 닫기 (터치 · 마우스). 버튼 위에서 시작하면 밀기를 시작하지 않습니다. */
function useSwipeDismiss(onDismiss: () => void) {
    const [offset, setOffset] = useState(0);
    const origin = useRef<number | null>(null);
    const moved = useRef(false);

    function end() {
        origin.current = null;
        if (Math.abs(offset) > 84) onDismiss();
        else setOffset(0);
    }

    return {
        style: offset ? ({ transform: `translateX(${offset}px)`, opacity: Math.max(0.2, 1 - Math.abs(offset) / 220) } as CSSProperties) : undefined,
        bind: {
            onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('[data-no-swipe]')) return;
                origin.current = event.clientX;
                moved.current = false;
            },
            onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
                if (origin.current === null) return;
                const delta = event.clientX - origin.current;
                if (Math.abs(delta) > 6) moved.current = true;
                if (moved.current) setOffset(delta);
            },
            onPointerUp: end,
            onPointerLeave: () => {
                if (origin.current !== null) end();
            },
            onPointerCancel: () => {
                origin.current = null;
                setOffset(0);
            },
            onClickCapture: (event: ReactMouseEvent) => {
                if (!moved.current) return;
                moved.current = false;
                event.preventDefault();
                event.stopPropagation();
            },
        },
    };
}
