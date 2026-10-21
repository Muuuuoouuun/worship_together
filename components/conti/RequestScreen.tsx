'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUp, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConti } from './context';
import type { RequestItem } from './planningBridge';
import { PlanningError, pill, pillOn, useDispatch } from './planningUi';
import { AddButton, Avatar, Eyebrow, SampleChip, ScreenTitle, body, chip, ink, line, selected, sub, attentionText, tabOn, tabOff } from './ui';

type Filter = 'all' | 'open' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'open', label: '진행 중' },
    { id: 'done', label: '완료' },
];

/** 받은 인도자·관리자와 요청을 남긴 사람은 할 말이 달라요 */
const QUICK_REPLIES = {
    resolver: ['확인했어요', '반영할게요', '연습 때 이야기해요'],
    author: ['감사해요', '확인했어요', '연습 때 이야기해요'],
};

export default function RequestScreen() {
    const { planning } = useConti();
    const [filter, setFilter] = useState<Filter>('all');
    const [openId, setOpenId] = useState<string | null>(null);
    const requests = planning.requests;
    const openCount = planning.openRequestCount;
    const shown = requests.filter((request) => (filter === 'all' ? true : filter === 'open' ? !request.done : request.done));
    const expanded = openId ?? shown.find((item) => !item.done)?.id ?? null;
    const requestHref = planning.planningHref.includes('?') ? `${planning.planningHref}&tab=requests` : `${planning.planningHref}?tab=requests`;

    return (
        <div className="space-y-6">
            <ScreenTitle
                eyebrow={<>요청 {planning.sample && <SampleChip className="ml-1" />}</>}
                title="요청 관리"
                trailing={openCount ? `${openCount}건 진행 중` : undefined}
                aside={<AddButton label="요청 남기기 (일정·요청 화면)" href={requestHref} />}
            />
            <PlanningError />

            <div role="tablist" aria-label="요청 상태" className={cn('flex gap-6 border-b', line)}>
                {FILTERS.map((item) => {
                    const active = item.id === filter;
                    const count = item.id === 'all' ? requests.length : item.id === 'open' ? openCount : requests.length - openCount;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setFilter(item.id)}
                            className={cn('relative -mb-px flex h-11 items-center gap-1 border-b-2 text-sm transition', active ? tabOn : tabOff)}
                        >
                            {item.label}
                            <span className="text-xs tabular-nums opacity-70">{count}</span>
                        </button>
                    );
                })}
            </div>

            {!planning.ready ? (
                <p className={cn('py-10 text-center text-sm', sub)}>요청을 불러오는 중…</p>
            ) : (
                <ul>
                    {shown.map((request) => (
                        <RequestRow key={request.id} request={request} expanded={expanded === request.id} onToggle={() => setOpenId(expanded === request.id ? '' : request.id)} />
                    ))}
                    {!shown.length && (
                        <li className="py-10 text-center">
                            <p className={cn('text-sm', sub)}>{filter === 'done' ? '완료한 요청이 없어요' : '표시할 요청이 없어요'}</p>
                            <Link href={requestHref} className={cn('mt-3 inline-flex h-9 items-center gap-1.5 text-xs font-semibold', ink)}>
                                <ExternalLink size={13} aria-hidden="true" />
                                일정·요청 화면에서 요청 남기기
                            </Link>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

function RequestRow({ request, expanded, onToggle }: { request: RequestItem; expanded: boolean; onToggle: () => void }) {
    const { send, busy } = useDispatch();
    const [text, setText] = useState('');

    function toggleDone() {
        if (!request.canResolve) return;
        if (request.source === 'alert') {
            if (!request.done) void send({ type: 'alert.resolve', alertId: request.id });
            return;
        }
        void send({ type: 'request.status', requestId: request.id, status: request.done ? 'open' : 'resolved' });
    }

    async function reply(message: string) {
        const ok = await send({ type: 'request.reply', requestId: request.id, body: message });
        if (ok) setText('');
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (text.trim()) void reply(text.trim());
    }

    const checkable = request.canResolve && !(request.source === 'alert' && request.done);

    return (
        <li className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
            <button
                type="button"
                onClick={toggleDone}
                disabled={!checkable || busy}
                aria-label={request.done ? '진행 중으로 되돌리기' : '완료로 표시'}
                aria-pressed={request.done}
                title={request.canResolve ? undefined : '수신 인도자 또는 관리자만 처리할 수 있어요'}
                className={cn(
                    'mt-5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition disabled:cursor-default',
                    request.done ? cn(selected, 'border-transparent') : 'border-input',
                    !checkable && !request.done && 'opacity-50',
                )}
            >
                {request.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            </button>

            <div className="min-w-0 flex-1">
                <button type="button" onClick={onToggle} aria-expanded={expanded} className="block w-full text-left">
                    <Eyebrow>
                        {request.kindLabel} · {request.context}
                        {request.status === 'reviewing' && <span className={cn('ml-1', attentionText)}>· {request.statusLabel}</span>}
                        {request.mine && <span className="ml-1 text-brand">· 내 요청</span>}
                    </Eyebrow>
                    <p className={cn('mt-0.5 text-[15px] font-medium leading-snug', request.done ? cn('line-through decoration-1', sub) : ink)}>{request.title}</p>
                    <p className={cn('mt-2 flex items-center gap-1.5 text-xs', sub)}>
                        {request.author && <Avatar name={request.author} size="xs" />}
                        <span className={body}>{request.author ?? '팀원'}</span>
                        <span aria-hidden="true">·</span>
                        {request.ago}
                        {request.replies.length > 0 && (
                            <>
                                <span aria-hidden="true">·</span>
                                답변 {request.replies.length}
                            </>
                        )}
                    </p>
                </button>

                {expanded && (
                    <div className="mt-3.5 space-y-3 animate-in fade-in duration-150">
                        {request.body.trim() !== request.title && <p className={cn('whitespace-pre-line rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed', chip, body)}>{request.body}</p>}

                        {request.replies.length > 0 && (
                            <ul className="space-y-2.5">
                                {request.replies.map((item) => (
                                    <li key={item.id} className={cn('flex gap-2.5', item.mine && 'flex-row-reverse text-right')}>
                                        <Avatar name={item.author ?? '팀원'} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-xs">
                                                <span className={cn('font-semibold', ink)}>{item.author ?? '팀원'}</span>
                                                <span className={cn('ml-1.5', sub)}>{item.ago}</span>
                                            </p>
                                            <p className={cn('mt-0.5 whitespace-pre-line text-[13px] leading-relaxed', body)}>{item.text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {request.source === 'alert' && request.canVolunteer && (
                            <div className="flex flex-wrap gap-1.5">
                                {request.volunteered ? (
                                    <button type="button" disabled={busy} onClick={() => void send({ type: 'slot.unvolunteer', eventId: request.eventId!, slotId: request.slotId! })} className={pill}>
                                        지원 취소
                                    </button>
                                ) : (
                                    <button type="button" disabled={busy} onClick={() => void send({ type: 'slot.volunteer', eventId: request.eventId!, slotId: request.slotId! })} className={pillOn}>
                                        이 역할에 지원하기
                                    </button>
                                )}
                            </div>
                        )}

                        {request.canReply && !request.done && (
                            <>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_REPLIES[request.canResolve ? 'resolver' : 'author'].map((item) => (
                                        <button key={item} type="button" disabled={busy} onClick={() => void reply(item)} className={pill}>
                                            {item}
                                        </button>
                                    ))}
                                </div>
                                <form onSubmit={submit} className={cn('flex h-11 items-center gap-2 rounded-full border pl-4 pr-1.5', line)}>
                                    <input
                                        value={text}
                                        maxLength={1500}
                                        onChange={(event) => setText(event.target.value)}
                                        placeholder="답변 남기기…"
                                        aria-label="답변"
                                        className={cn('h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', ink)}
                                    />
                                    <button type="submit" disabled={busy || !text.trim()} aria-label="답변 보내기" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30', selected)}>
                                        <ArrowUp size={15} />
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}
