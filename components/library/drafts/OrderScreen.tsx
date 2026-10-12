'use client';

import { useState } from 'react';
import { ArrowLeft, BookOpen, ChevronDown, CirclePlay, FileText, HandHeart, Headphones, MessageCircle, Radio, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SECTION_NAMES,
    SETLISTS,
    SETLIST_STATUS,
    commentsOf,
    dayOf,
    md,
    member,
    monthOf,
    setlistById,
    songsOf,
    weekLabel,
    type LinkKind,
    type Song,
} from './draftData';
import { AddButton, Avatar, AvatarStack, Eyebrow, KeyText, RoundIconButton, TONE_BLOCK, TONE_ICON, body, chip, ink, line, selected, sub } from './ui';

const LINK_ICON: Record<LinkKind, LucideIcon> = {
    video: CirclePlay,
    sheet: FileText,
    mr: Headphones,
};

export default function OrderScreen({ setlistId, onBack, onSelect }: { setlistId: string; onBack: () => void; onSelect: (id: string) => void }) {
    const [picking, setPicking] = useState(false);
    const setlist = setlistById(setlistId);
    const owner = member(setlist.owner);
    const songs = songsOf(setlist.items);
    const comments = commentsOf(setlist.items);
    const commenters = Array.from(new Set(comments.map((comment) => comment.from)));
    const choices = SETLISTS.filter((item) => item.items.length > 0);
    const numbers = setlist.items.map((_, index) => songsOf(setlist.items.slice(0, index + 1)).length);

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <RoundIconButton label="콘티 내역으로" onClick={onBack}>
                    <ArrowLeft size={18} />
                </RoundIconButton>
                <button type="button" onClick={() => setPicking((value) => !value)} aria-expanded={picking} className="min-w-0 flex-1 text-left">
                    <Eyebrow>
                        {weekLabel(setlist.date)} · {owner?.name} 담당
                    </Eyebrow>
                    <span className={cn('mt-0.5 flex items-center gap-1.5 text-[17px] font-semibold tracking-tight', ink)}>
                        {monthOf(setlist.date)}월 {dayOf(setlist.date)}일
                        <span className={cn('font-normal', sub)}>주일</span>
                        <ChevronDown size={18} className={cn('transition-transform', picking && 'rotate-180')} aria-hidden="true" />
                    </span>
                </button>
                <AddButton label="곡 추가" />
            </header>

            {picking && (
                <ul className={cn('overflow-hidden rounded-2xl border animate-in fade-in slide-in-from-top-1 duration-150', line)}>
                    {choices.map((item) => (
                        <li key={item.id} className={cn('border-b last:border-b-0', line)}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(item.id);
                                    setPicking(false);
                                }}
                                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left text-sm', item.id === setlist.id && 'bg-neutral-50 dark:bg-neutral-800/60')}
                            >
                                <span className={cn('w-10 tabular-nums', sub)}>{md(item.date)}</span>
                                <span className={cn('flex-1 truncate font-medium', ink)}>{item.theme}</span>
                                <span className={cn('text-xs', SETLIST_STATUS[item.status].text)}>{SETLIST_STATUS[item.status].label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div>
                <Eyebrow>
                    {setlist.service} · <span className={SETLIST_STATUS[setlist.status].text}>{SETLIST_STATUS[setlist.status].label}</span>
                </Eyebrow>
                <h2 className={cn('mt-1 text-xl font-semibold tracking-tight', ink)}>{setlist.theme}</h2>
                <div className="mt-3 flex items-center justify-between gap-3">
                    <p className={cn('text-xs tabular-nums', sub)}>
                        {songs.length}곡 · Key {songs.map((item) => item.key).join('·')}
                    </p>
                    {comments.length > 0 && (
                        <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                            <AvatarStack ids={commenters} max={3} size="xs" />
                            코멘트 {comments.length}
                        </span>
                    )}
                </div>
            </div>

            <ol aria-label={`${setlist.theme} 콘티 순서`} className="space-y-3">
                {setlist.items.map((item, index) => {
                    if (item.kind === 'moment') {
                        const Icon = item.moment === 'prayer' ? HandHeart : BookOpen;
                        return (
                            <li key={item.id} className={cn('flex items-start gap-3 rounded-2xl px-4 py-3', TONE_BLOCK.lilac)}>
                                <Icon size={16} className={cn('mt-0.5 shrink-0', TONE_ICON.lilac)} aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className={cn('text-sm font-medium', ink)}>{item.title}</p>
                                    {item.memo && <p className={cn('mt-0.5 text-xs leading-relaxed', sub)}>{item.memo}</p>}
                                </div>
                            </li>
                        );
                    }
                    return <SongCard key={item.id} song={item} number={numbers[index]} />;
                })}
            </ol>

            <button type="button" className={cn('flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99]', selected)}>
                <Radio size={17} aria-hidden="true" />
                이 콘티로 예배 열기
            </button>
        </div>
    );
}

function SongCard({ song, number }: { song: Song; number: number }) {
    const lead = member(song.lead);
    return (
        <li className={cn('rounded-3xl border p-4', line)}>
            <div className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-px text-[15px] font-semibold tabular-nums text-neutral-300 dark:text-neutral-600">{String(number).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className={cn('text-[15px] font-semibold leading-snug', ink)}>{song.title}</h3>
                        <span className={cn('shrink-0 rounded-lg px-2 py-1 text-xs tabular-nums', chip, ink)}>
                            <KeyText from={song.originalKey} to={song.key} />
                        </span>
                    </div>
                    <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                        {song.bpm} BPM · 리드 {lead?.name}
                    </p>

                    <div className="mt-3.5">
                        <p className={cn('mb-1.5 text-[11px] font-medium', sub)}>송폼</p>
                        <ol aria-label="송폼" className="flex flex-wrap gap-1">
                            {song.form.map((code, index) => (
                                <li
                                    key={`${code}-${index}`}
                                    title={SECTION_NAMES[code] ?? code}
                                    className={cn(
                                        'flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums',
                                        code === 'C' || code === 'Tag' ? selected : code === 'B' ? cn('border', 'border-neutral-900 dark:border-white', ink) : cn(chip, body),
                                    )}
                                >
                                    {code}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <ul aria-label="링크" className="mt-3 flex flex-wrap gap-1.5">
                        {song.links.map((link) => {
                            const Icon = LINK_ICON[link.kind];
                            return (
                                <li key={link.kind}>
                                    <button type="button" className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:bg-neutral-50 dark:hover:bg-neutral-800', line, ink)}>
                                        <Icon size={14} aria-hidden="true" />
                                        {link.label}
                                        {link.fresh && <span className="rounded-full bg-orange-500 px-1.5 text-[9px] font-bold leading-4 text-white">NEW</span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {song.notes.length > 0 && (
                        <div className={cn('mt-3 rounded-2xl px-3.5 py-3', TONE_BLOCK.peach)}>
                            <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold', TONE_ICON.peach)}>
                                <TriangleAlert size={13} aria-hidden="true" />
                                특이사항
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {song.notes.map((note) => (
                                    <li key={note} className={cn('flex gap-2 text-[13px] leading-relaxed', ink)}>
                                        <span className={cn('mt-[0.55rem] size-1 shrink-0 rounded-full bg-current opacity-40')} aria-hidden="true" />
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {song.comments.length > 0 && (
                        <ul aria-label="팀원 코멘트" className={cn('mt-3.5 space-y-3 border-t pt-3.5', line)}>
                            {song.comments.map((comment, index) => (
                                <li key={index} className="flex gap-2.5">
                                    <Avatar id={comment.from} size="sm" />
                                    <div className="min-w-0">
                                        <p className="text-xs">
                                            <span className={cn('font-semibold', ink)}>{member(comment.from)?.name}</span>
                                            <span className={cn('ml-1.5', sub)}>{comment.ago}</span>
                                        </p>
                                        <p className={cn('mt-0.5 text-[13px] leading-relaxed', body)}>{comment.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <button type="button" className={cn('mt-3 inline-flex h-8 items-center gap-1.5 text-xs font-medium', sub)}>
                        <MessageCircle size={14} aria-hidden="true" />
                        코멘트 남기기
                    </button>
                </div>
            </div>
        </li>
    );
}
