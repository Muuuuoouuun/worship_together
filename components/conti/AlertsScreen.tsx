'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, BellRing, CheckCheck, CircleCheck, ExternalLink, Hand, Inbox, ListMusic, MessageCircle, Repeat, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenId } from './model';
import { useConti } from './context';
import type { Notice, NoticeCategory, NoticeGroup, NoticeKind } from './planningBridge';
import { PlanningError, useDispatch } from './planningUi';
import { AskCards } from './substituteUi';
import { Avatar, Eyebrow, RoundIconButton, SampleChip, TONE_BLOCK, TONE_ICON, body, chip, ink, line, sub, attention, tabOn, tabOff } from './ui';
import type { Tone } from './model';

const NOTICE_META: Record<NoticeKind, { icon: LucideIcon; tone: Tone }> = {
    request: { icon: Inbox, tone: 'peach' },
    reply: { icon: MessageCircle, tone: 'sky' },
    invite: { icon: BellRing, tone: 'sand' },
    accept: { icon: UserCheck, tone: 'mint' },
    decline: { icon: UserX, tone: 'peach' },
    substitute: { icon: Hand, tone: 'peach' },
    volunteer: { icon: Hand, tone: 'mint' },
    conti: { icon: ListMusic, tone: 'mint' },
    schedule: { icon: Bell, tone: 'sky' },
    rotation: { icon: Repeat, tone: 'lilac' },
    comment: { icon: MessageCircle, tone: 'sky' },
    other: { icon: Bell, tone: 'sky' },
};

const FILTERS: { id: 'all' | NoticeCategory; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'conti', label: '콘티' },
    { id: 'team', label: '팀' },
    { id: 'request', label: '요청' },
];

const GROUPS: NoticeGroup[] = ['오늘', '어제', '이번 주', '이전'];

/** onBack 이 있으면(시안 앱 화면) 이번 주로 돌아가는 버튼을 보여줍니다. 페이지 탭으로 열 때는 없습니다. */
export default function AlertsScreen({ onBack, openOrder, go }: { onBack?: () => void; openOrder: (id: string) => void; go: (screen: ScreenId) => void }) {
    const { planning, setlists } = useConti();
    const { send, busy } = useDispatch();
    const [filter, setFilter] = useState<'all' | NoticeCategory>('all');
    const notices = planning.notices;
    const unread = planning.unreadCount;
    const shown = notices.filter((notice) => filter === 'all' || notice.category === filter);

    function read(notice: Notice) {
        if (!notice.unread) return;
        if (notice.kind === 'comment') planning.actions?.markFeedSeen(notice.createdAt);
        else void send({ type: 'notification.read', notificationId: notice.id });
    }

    function readAll() {
        planning.actions?.markFeedSeen(new Date().toISOString());
        if (notices.some((notice) => notice.kind !== 'comment' && notice.unread)) void send({ type: 'notification.readAll' });
    }

    function open(notice: Notice) {
        read(notice);
        if (notice.target === 'conti') {
            if (setlists.some((item) => item.id === notice.entityId)) openOrder(notice.entityId);
            else go('conti');
            return;
        }
        if (notice.target === 'requests') go('requests');
        else if (notice.target === 'schedule') go('team');
    }

    const rotationHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=rotation` : `${planning.planningHref}?tab=rotation`;

    return (
        <div className="space-y-5">
            <header className="flex items-center gap-3">
                {onBack && (
                    <RoundIconButton label="이번 주로" onClick={onBack}>
                        <ArrowLeft size={18} />
                    </RoundIconButton>
                )}
                <div className="min-w-0 flex-1">
                    <Eyebrow>알림 {planning.sample && <SampleChip className="ml-1" />}</Eyebrow>
                    <h2 className={cn('mt-0.5 text-[17px] font-semibold tracking-tight', ink)}>
                        팀 소식
                        {unread > 0 && <span className={cn('ml-1.5 font-normal', sub)}>새 소식 {unread}</span>}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={readAll}
                    disabled={!unread || busy || !planning.actions}
                    className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:opacity-40', line, ink)}
                >
                    <CheckCheck size={14} aria-hidden="true" />
                    모두 읽음
                </button>
            </header>
            <PlanningError />
            {planning.ready && <AskCards />}

            <div role="tablist" aria-label="알림 종류" className={cn('flex gap-6 border-b', line)}>
                {FILTERS.map((item) => {
                    const active = item.id === filter;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setFilter(item.id)}
                            className={cn('-mb-px h-11 border-b-2 text-sm transition', active ? tabOn : tabOff)}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {!planning.ready ? (
                <p className={cn('py-10 text-center text-sm', sub)}>소식을 불러오는 중…</p>
            ) : (
                <>
                    {GROUPS.map((group) => {
                        const items = shown.filter((notice) => notice.group === group);
                        if (!items.length) return null;
                        return (
                            <section key={group} aria-label={group}>
                                <Eyebrow>{group}</Eyebrow>
                                <ul className="mt-1">
                                    {items.map((notice) => (
                                        <NoticeRow key={notice.id} notice={notice} onOpen={() => open(notice)} onRead={() => read(notice)} rotationHref={rotationHref} />
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                    {!shown.length && <p className={cn('py-10 text-center text-sm', sub)}>{planning.viewer ? '새로운 소식이 없어요' : '로그인하거나 팀을 등록하면 팀 소식이 보여요'}</p>}
                </>
            )}
        </div>
    );
}

export function NoticeAvatar({ notice, size = 'md' }: { notice: Notice; size?: 'sm' | 'md' }) {
    const meta = NOTICE_META[notice.kind];
    const Icon = meta.icon;
    if (!notice.actor) {
        return (
            <span className={cn('flex shrink-0 items-center justify-center rounded-full', size === 'sm' ? 'size-7' : 'size-9', TONE_BLOCK[meta.tone])}>
                <Icon size={size === 'sm' ? 13 : 16} className={TONE_ICON[meta.tone]} aria-hidden="true" />
            </span>
        );
    }
    return (
        <span className="relative inline-flex shrink-0 self-start">
            <Avatar name={notice.actor} size={size} />
            <span
                className={cn(
                    'absolute flex items-center justify-center rounded-full bg-card ring-2 ring-card',
                    size === 'sm' ? '-bottom-1.5 -right-1.5 size-4' : '-bottom-1 -right-1 size-[1.125rem]',
                )}
            >
                <span className={cn('flex size-full items-center justify-center rounded-full', TONE_BLOCK[meta.tone])}>
                    <Icon size={size === 'sm' ? 9 : 10} strokeWidth={2.5} className={TONE_ICON[meta.tone]} aria-hidden="true" />
                </span>
            </span>
        </span>
    );
}

function NoticeRow({ notice, onOpen, onRead, rotationHref }: { notice: Notice; onOpen: () => void; onRead: () => void; rotationHref: string }) {
    const action =
        notice.target === 'conti' ? '콘티 보기' : notice.target === 'requests' ? '요청 보기' : notice.target === 'schedule' ? '팀 배치 보기' : null;
    return (
        <li className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
            <NoticeAvatar notice={notice} />
            <div className="min-w-0 flex-1">
                <button type="button" onClick={onRead} className="block w-full text-left">
                    <p className="text-sm leading-snug">
                        {notice.actor && <span className={cn('font-semibold', ink)}>{notice.actor}님 · </span>}
                        <span className={cn(notice.actor ? body : cn('font-medium', ink))}>{notice.title}</span>
                        {notice.urgent && notice.unread && <span className={cn('ml-1.5 rounded-full px-1.5 text-[10px] font-bold leading-4', attention)}>긴급</span>}
                    </p>
                    {notice.quote ? (
                        <p className={cn('mt-2 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed', chip, body)}>{notice.quote}</p>
                    ) : (
                        notice.message && notice.message !== notice.title && <p className={cn('mt-1 text-xs leading-relaxed', sub)}>{notice.message}</p>
                    )}
                    <p className={cn('mt-1.5 text-[11px]', sub)}>{notice.ago}</p>
                </button>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {action && (
                        <button type="button" onClick={onOpen} className={cn('inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-semibold', line, ink)}>
                            {action}
                        </button>
                    )}
                    {notice.target === 'rotation' && (
                        <Link href={rotationHref} className={cn('inline-flex h-8 items-center gap-1 rounded-full border px-3.5 text-xs font-semibold', line, ink)}>
                            <ExternalLink size={12} aria-hidden="true" />
                            로테이션 보기
                        </Link>
                    )}
                    {notice.unread && notice.kind !== 'comment' && (
                        <button type="button" onClick={onRead} className={cn('inline-flex h-8 items-center gap-1 px-2 text-xs font-medium', sub)}>
                            <CircleCheck size={13} aria-hidden="true" />
                            확인
                        </button>
                    )}
                </div>
            </div>
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notice.unread ? 'bg-secondary' : 'bg-transparent')} aria-label={notice.unread ? '읽지 않음' : undefined} />
        </li>
    );
}
