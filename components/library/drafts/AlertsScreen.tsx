'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCheck, CircleCheck, Clock, Inbox, MessageCircle, PencilLine, Upload, UserCheck, UserX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NOTICE_KIND, member, type Notice, type NoticeCategory, type NoticeKind } from './draftData';
import { Avatar, Eyebrow, RoundIconButton, TONE_BLOCK, TONE_ICON, body, chip, ink, line, sub } from './ui';

export const NOTICE_ICON: Record<NoticeKind, LucideIcon> = {
    request: Inbox,
    comment: MessageCircle,
    decline: UserX,
    accept: UserCheck,
    pending: Clock,
    confirm: CircleCheck,
    upload: Upload,
    edit: PencilLine,
};

const FILTERS: { id: 'all' | NoticeCategory; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'conti', label: '콘티' },
    { id: 'team', label: '팀' },
    { id: 'request', label: '요청' },
];

const GROUPS: Notice['group'][] = ['오늘', '어제', '이번 주'];

export default function AlertsScreen({ notices, onRead, onReadAll, onBack }: { notices: Notice[]; onRead: (id: string) => void; onReadAll: () => void; onBack: () => void }) {
    const [filter, setFilter] = useState<'all' | NoticeCategory>('all');
    const unread = notices.filter((notice) => notice.unread).length;
    const shown = notices.filter((notice) => filter === 'all' || NOTICE_KIND[notice.kind].category === filter);

    return (
        <div className="space-y-5">
            <header className="flex items-center gap-3">
                <RoundIconButton label="이번 주로" onClick={onBack}>
                    <ArrowLeft size={18} />
                </RoundIconButton>
                <div className="min-w-0 flex-1">
                    <Eyebrow>알림</Eyebrow>
                    <h1 className={cn('mt-0.5 text-[17px] font-semibold tracking-tight', ink)}>
                        팀 소식
                        {unread > 0 && <span className={cn('ml-1.5 font-normal', sub)}>새 소식 {unread}</span>}
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={onReadAll}
                    disabled={!unread}
                    className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:opacity-40', line, ink)}
                >
                    <CheckCheck size={14} aria-hidden="true" />
                    모두 읽음
                </button>
            </header>

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
                            className={cn('-mb-px h-11 border-b-2 text-sm transition', active ? cn('border-neutral-900 font-semibold dark:border-white', ink) : cn('border-transparent', sub))}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {GROUPS.map((group) => {
                const items = shown.filter((notice) => notice.group === group);
                if (!items.length) return null;
                return (
                    <section key={group} aria-label={group}>
                        <Eyebrow>{group}</Eyebrow>
                        <ul className="mt-1">
                            {items.map((notice) => (
                                <NoticeRow key={notice.id} notice={notice} onRead={onRead} />
                            ))}
                        </ul>
                    </section>
                );
            })}
            {!shown.length && <p className={cn('py-10 text-center text-sm', sub)}>새로운 소식이 없어요</p>}
        </div>
    );
}

export function NoticeAvatar({ notice, size = 'md' }: { notice: Notice; size?: 'sm' | 'md' }) {
    const Icon = NOTICE_ICON[notice.kind];
    const tone = NOTICE_KIND[notice.kind].tone;
    return (
        <span className="relative inline-flex shrink-0 self-start">
            <Avatar id={notice.actor} size={size} />
            <span
                className={cn(
                    'absolute flex items-center justify-center rounded-full bg-white ring-2 ring-white dark:bg-neutral-900 dark:ring-neutral-900',
                    size === 'sm' ? '-bottom-1.5 -right-1.5 size-4' : '-bottom-1 -right-1 size-[1.125rem]',
                )}
            >
                <span className={cn('flex size-full items-center justify-center rounded-full', TONE_BLOCK[tone])}>
                    <Icon size={size === 'sm' ? 9 : 10} strokeWidth={2.5} className={TONE_ICON[tone]} aria-hidden="true" />
                </span>
            </span>
        </span>
    );
}

function NoticeRow({ notice, onRead }: { notice: Notice; onRead: (id: string) => void }) {
    const actor = member(notice.actor);
    return (
        <li className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
            <NoticeAvatar notice={notice} />
            <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onRead(notice.id)} className="block w-full text-left">
                    <p className="text-sm leading-snug">
                        <span className={cn('font-semibold', ink)}>{actor?.name}</span>
                        <span className={body}>님이 {notice.message}</span>
                    </p>
                    {notice.quote && <p className={cn('mt-2 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed', chip, body)}>{notice.quote}</p>}
                    <p className={cn('mt-1.5 text-[11px]', sub)}>{notice.ago}</p>
                </button>
                {notice.action && (
                    <button type="button" className={cn('mt-2.5 inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-semibold', line, ink)}>
                        {notice.action}
                    </button>
                )}
            </div>
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', notice.unread ? 'bg-orange-500' : 'bg-transparent')} aria-label={notice.unread ? '읽지 않음' : undefined} />
        </li>
    );
}
