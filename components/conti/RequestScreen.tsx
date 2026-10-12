'use client';

import { useState } from 'react';
import { ArrowUp, Check, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REQUEST_KIND, member, type TeamRequest } from './mockData';
import { useConti } from './context';
import { Avatar, Eyebrow, RoundIconButton, SampleChip, ScreenTitle, body, chip, ink, line, selected, sub } from './ui';

type Filter = 'all' | 'open' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'open', label: '진행 중' },
    { id: 'done', label: '완료' },
];

const QUICK_REPLIES = ['확인했어요', '반영할게요', '연습 때 이야기해요'];

export default function RequestScreen({ requests, onToggle }: { requests: TeamRequest[]; onToggle: (id: string) => void }) {
    const { sampleSections } = useConti();
    const [filter, setFilter] = useState<Filter>('all');
    const [openId, setOpenId] = useState<string | null>('r1');
    const openCount = requests.filter((request) => !request.done).length;
    const shown = requests.filter((request) => (filter === 'all' ? true : filter === 'open' ? !request.done : request.done));

    return (
        <div className="space-y-6">
            <ScreenTitle
                eyebrow={<>요청 {sampleSections && <SampleChip className="ml-1" />}</>}
                title="요청 관리"
                trailing={`${openCount}건 진행 중`}
                aside={
                    <RoundIconButton label="요청 필터">
                        <ListFilter size={17} />
                    </RoundIconButton>
                }
            />

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
                            className={cn('relative -mb-px flex h-11 items-center gap-1 border-b-2 text-sm transition', active ? cn('border-neutral-900 font-semibold dark:border-white', ink) : cn('border-transparent', sub))}
                        >
                            {item.label}
                            <span className="text-xs tabular-nums opacity-70">{count}</span>
                        </button>
                    );
                })}
            </div>

            <ul>
                {shown.map((request) => {
                    const from = member(request.from);
                    const expanded = openId === request.id;
                    return (
                        <li key={request.id} className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
                            <button
                                type="button"
                                onClick={() => onToggle(request.id)}
                                aria-label={request.done ? '진행 중으로 되돌리기' : '완료로 표시'}
                                aria-pressed={request.done}
                                className={cn(
                                    'mt-5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition',
                                    request.done ? cn(selected, 'border-transparent') : 'border-neutral-300 dark:border-neutral-600',
                                )}
                            >
                                {request.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                            </button>

                            <div className="min-w-0 flex-1">
                                <button type="button" onClick={() => setOpenId(expanded ? null : request.id)} aria-expanded={expanded} className="block w-full text-left">
                                    <Eyebrow>
                                        {REQUEST_KIND[request.kind]} · {request.context}
                                    </Eyebrow>
                                    <p className={cn('mt-0.5 text-[15px] font-medium leading-snug', request.done ? cn('line-through decoration-1', sub) : ink)}>{request.title}</p>
                                    <p className={cn('mt-2 flex items-center gap-1.5 text-xs', sub)}>
                                        <Avatar id={request.from} size="xs" />
                                        <span className={body}>{from?.name}</span>
                                        <span aria-hidden="true">·</span>
                                        {request.ago}
                                    </p>
                                </button>

                                {expanded && (
                                    <div className="mt-3.5 space-y-3 animate-in fade-in duration-150">
                                        <p className={cn('rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed', chip, body)}>{request.body}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {QUICK_REPLIES.map((reply) => (
                                                <button key={reply} type="button" className={cn('h-8 rounded-full border px-3 text-xs', line, ink)}>
                                                    {reply}
                                                </button>
                                            ))}
                                        </div>
                                        <div className={cn('flex h-11 items-center gap-2 rounded-full border pl-4 pr-1.5', line)}>
                                            <span className={cn('flex-1 text-sm', sub)}>답변 남기기…</span>
                                            <span className={cn('flex size-8 items-center justify-center rounded-full', selected)} aria-hidden="true">
                                                <ArrowUp size={15} />
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
                {!shown.length && <li className={cn('py-10 text-center text-sm', sub)}>표시할 요청이 없어요</li>}
            </ul>
        </div>
    );
}
