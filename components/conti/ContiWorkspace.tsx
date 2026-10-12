'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { CalendarPlus, House, Inbox, ListMusic, MessageSquarePlus, Plus, UsersRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NOTICES, REQUESTS, THIS_WEEK_SETLIST_ID, type ScreenId } from './mockData';
import { ink, line, selected } from './ui';
import WeekScreen from './WeekScreen';
import ContiScreen from './ContiScreen';
import OrderScreen from './OrderScreen';
import TeamScreen from './TeamScreen';
import RequestScreen from './RequestScreen';
import AlertsScreen from './AlertsScreen';

const NAV: { id: Exclude<ScreenId, 'order' | 'alerts'>; label: string; icon: LucideIcon }[] = [
    { id: 'week', label: '이번 주', icon: House },
    { id: 'conti', label: '콘티', icon: ListMusic },
    { id: 'team', label: '팀', icon: UsersRound },
    { id: 'requests', label: '요청', icon: Inbox },
];

const QUICK_ACTIONS: { label: string; detail: string; icon: LucideIcon }[] = [
    { label: '새 콘티 만들기', detail: '곡을 고르고 순서를 정해요', icon: ListMusic },
    { label: '일정 추가', detail: '연습·리허설·기도회', icon: CalendarPlus },
    { label: '요청 남기기', detail: 'Key 변경, 대체, 질문', icon: MessageSquarePlus },
];

/** 화면 상단의 아주 옅은 브랜드 색 번짐 (레퍼런스의 라벤더 그라데이션 역할) */
const TOP_GLOW: CSSProperties = {
    backgroundImage: 'radial-gradient(90% 100% at 85% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 70%)',
};

/** 콘티·악보 페이지 안에서 쓰는 상단 탭 (순서는 콘티에서 들어가는 상세 화면) */
const PAGE_TABS: { id: Exclude<ScreenId, 'order'>; label: string }[] = [
    { id: 'week', label: '이번 주' },
    { id: 'conti', label: '콘티' },
    { id: 'team', label: '팀 배치' },
    { id: 'requests', label: '요청' },
    { id: 'alerts', label: '팀 소식' },
];

/**
 * - embedded: 대시보드 콘티·악보 페이지. 앱 공통 내비 아래에서 상단 탭으로 화면을 전환합니다.
 * - app: 휴대폰 단독 화면(시안 페이지). 자체 하단 내비를 씁니다.
 * - framed: 시안 페이지의 휴대폰 프레임 안.
 */
export type WorkspaceMode = 'embedded' | 'app' | 'framed';

export default function ContiWorkspace({
    initialScreen = 'week',
    initialSetlistId = THIS_WEEK_SETLIST_ID,
    mode = 'embedded',
}: {
    initialScreen?: ScreenId;
    initialSetlistId?: string;
    mode?: WorkspaceMode;
}) {
    const framed = mode === 'framed';
    const embedded = mode === 'embedded';
    const [screen, setScreen] = useState<ScreenId>(initialScreen);
    const [setlistId, setSetlistId] = useState(initialSetlistId);
    const [requests, setRequests] = useState(REQUESTS);
    const [notices, setNotices] = useState(NOTICES);
    const [sheetOpen, setSheetOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeNav = screen === 'order' ? 'conti' : screen === 'alerts' ? 'week' : screen;
    const openCount = requests.filter((request) => !request.done).length;

    function syncUrl(next: ScreenId, nextSetlistId: string) {
        if (!embedded) return;
        const url = new URL(window.location.href);
        url.searchParams.set('tab', next);
        if (next === 'order') url.searchParams.set('setlist', nextSetlistId);
        else url.searchParams.delete('setlist');
        window.history.replaceState(null, '', url);
    }

    function go(next: ScreenId, nextSetlistId = setlistId) {
        setScreen(next);
        setSheetOpen(false);
        syncUrl(next, nextSetlistId);
        if (framed) scrollRef.current?.scrollTo({ top: 0 });
        else window.scrollTo({ top: 0 });
    }

    function openOrder(id: string) {
        setSetlistId(id);
        go('order', id);
    }

    function selectSetlist(id: string) {
        setSetlistId(id);
        syncUrl('order', id);
    }

    function toggleRequest(id: string) {
        setRequests((list) => list.map((request) => (request.id === id ? { ...request, done: !request.done } : request)));
    }

    function readNotice(id: string) {
        setNotices((list) => list.map((notice) => (notice.id === id ? { ...notice, unread: false } : notice)));
    }

    function readAllNotices() {
        setNotices((list) => list.map((notice) => ({ ...notice, unread: false })));
    }

    const screens = (
        <>
            {screen === 'week' && <WeekScreen requests={requests} notices={notices} go={go} openOrder={openOrder} />}
            {screen === 'conti' && <ContiScreen openOrder={openOrder} />}
            {screen === 'order' && <OrderScreen setlistId={setlistId} onBack={() => go('conti')} onSelect={selectSetlist} />}
            {screen === 'team' && <TeamScreen />}
            {screen === 'requests' && <RequestScreen requests={requests} onToggle={toggleRequest} />}
            {screen === 'alerts' && <AlertsScreen notices={notices} onRead={readNotice} onReadAll={readAllNotices} onBack={() => go('week')} />}
        </>
    );

    if (embedded) {
        const unread = notices.filter((notice) => notice.unread).length;
        const activeTab = screen === 'order' ? 'conti' : screen;
        return (
            <div className="relative isolate -mx-3 break-keep bg-white ring-black/5 dark:bg-neutral-900 dark:ring-white/10 sm:mx-0 sm:rounded-[2rem] sm:shadow-sm sm:ring-1">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 sm:rounded-t-[2rem]" style={TOP_GLOW} />

                <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 border-b border-neutral-100 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90 sm:rounded-t-[2rem] lg:top-0">
                    <div role="tablist" aria-label="콘티·악보 화면" className="no-scrollbar flex gap-5 overflow-x-auto px-5 sm:px-8">
                        {PAGE_TABS.map((tab) => {
                            const active = activeTab === tab.id;
                            const count = tab.id === 'requests' ? openCount : tab.id === 'alerts' ? unread : 0;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => go(tab.id)}
                                    className={cn(
                                        'relative -mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-2 text-sm transition',
                                        active ? cn('border-neutral-900 font-semibold dark:border-white', ink) : 'border-transparent text-neutral-500 dark:text-neutral-400',
                                    )}
                                >
                                    {tab.label}
                                    {count > 0 && (
                                        <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold tabular-nums text-white">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="px-5 pb-10 pt-6 sm:px-8 sm:pt-8">{screens}</div>
            </div>
        );
    }

    return (
        <div className={cn('relative isolate flex flex-col break-keep bg-white dark:bg-neutral-900', framed ? 'h-full overflow-hidden' : 'min-h-dvh')}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" style={TOP_GLOW} />

            <div ref={scrollRef} className={cn('flex-1', framed && 'no-scrollbar overflow-y-auto overscroll-contain')}>
                <div className={cn('px-5 pb-32', framed ? 'pt-12' : 'pt-[max(1.75rem,env(safe-area-inset-top))]')}>
                    {screens}
                </div>
            </div>

            <div
                aria-hidden="true"
                className={cn(
                    'pointer-events-none z-20 h-28 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-neutral-900 dark:via-neutral-900/80',
                    framed ? 'absolute inset-x-0 bottom-0' : 'fixed inset-x-0 bottom-0 mx-auto max-w-md',
                )}
            />

            {sheetOpen && (
                <>
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={() => setSheetOpen(false)}
                        className={cn('z-30 bg-neutral-900/10 backdrop-blur-[1px] dark:bg-black/40', framed ? 'absolute inset-0' : 'fixed inset-0')}
                    />
                    <div
                        role="menu"
                        aria-label="빠른 추가"
                        className={cn(
                            'z-40 overflow-hidden rounded-3xl bg-white p-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] ring-1 ring-neutral-100 animate-in fade-in slide-in-from-bottom-2 duration-150 dark:bg-neutral-800 dark:ring-neutral-700',
                            framed ? 'absolute inset-x-4 bottom-24' : 'fixed inset-x-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5rem)] mx-auto max-w-[26rem]',
                        )}
                    >
                        {QUICK_ACTIONS.map((action) => (
                            <button key={action.label} type="button" role="menuitem" onClick={() => setSheetOpen(false)} className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                                <span className={cn('flex size-10 items-center justify-center rounded-2xl border', line, ink)}>
                                    <action.icon size={18} aria-hidden="true" />
                                </span>
                                <span>
                                    <span className={cn('block text-sm font-medium', ink)}>{action.label}</span>
                                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">{action.detail}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            <nav
                aria-label="시안 앱 메뉴"
                className={cn('z-40', framed ? 'absolute inset-x-4 bottom-4' : 'fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-[26rem]')}
            >
                <div className="flex h-16 items-center justify-around rounded-[1.75rem] bg-white/95 px-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.22)] ring-1 ring-neutral-100 backdrop-blur dark:bg-neutral-800/95 dark:ring-neutral-700">
                    {NAV.slice(0, 2).map((item) => (
                        <NavButton key={item.id} item={item} active={activeNav === item.id} onClick={() => go(item.id)} />
                    ))}
                    <button
                        type="button"
                        aria-label="빠른 추가"
                        aria-expanded={sheetOpen}
                        onClick={() => setSheetOpen((value) => !value)}
                        className={cn('flex size-12 items-center justify-center rounded-2xl transition active:scale-95', selected)}
                    >
                        <Plus size={22} strokeWidth={2.25} className={cn('transition-transform', sheetOpen && 'rotate-45')} />
                    </button>
                    {NAV.slice(2).map((item) => (
                        <NavButton key={item.id} item={item} active={activeNav === item.id} onClick={() => go(item.id)} badge={item.id === 'requests' ? openCount : 0} />
                    ))}
                </div>
            </nav>
        </div>
    );
}

function NavButton({ item, active, onClick, badge = 0 }: { item: (typeof NAV)[number]; active: boolean; onClick: () => void; badge?: number }) {
    const Icon = item.icon;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={cn('relative flex h-12 w-14 flex-col items-center justify-center gap-0.5 transition', active ? 'text-primary' : 'text-neutral-500 dark:text-neutral-400')}
        >
            <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                {badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white dark:ring-neutral-800">
                        {badge}
                    </span>
                )}
            </span>
            {active && <span className="text-[10px] font-semibold">{item.label}</span>}
        </button>
    );
}
