'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    BookOpen,
    Check,
    ChevronDown,
    CirclePlay,
    FileText,
    HandHeart,
    Headphones,
    Link2,
    MessageCircle,
    Pencil,
    Radio,
    TriangleAlert,
    X,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { COMMON_KEYS } from '@/lib/setlistDetailsStorage';
import {
    SECTION_NAMES,
    SECTION_PALETTE,
    SETLIST_STATUS,
    commentsOf,
    dayOf,
    displayTitle,
    md,
    monthOf,
    songsOf,
    weekLabel,
    weekday,
    type ContiSetlist,
    type ContiSong,
    type LinkKind,
} from './model';
import { useConti, type SetlistDraft, type SongDraft } from './context';
import { AddButton, Avatar, AvatarStack, Eyebrow, KeyText, RoundIconButton, TONE_BLOCK, TONE_ICON, body, chip, ink, line, selected, sub, STATUS, attention } from './ui';

const LINK_ICON: Record<LinkKind, LucideIcon> = {
    video: CirclePlay,
    sheet: FileText,
    mr: Headphones,
    other: Link2,
};

const field = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70';

function draftFromSetlist(setlist: ContiSetlist): SetlistDraft {
    const songs = songsOf(setlist.items);
    const drafts: Record<string, SongDraft> = {};
    for (const song of songs) {
        if (drafts[song.songId]) continue;
        drafts[song.songId] = {
            key: song.key,
            bpm: song.bpm === null ? '' : String(song.bpm),
            lead: song.lead ?? '',
            form: [...song.form],
            notes: song.notes.join('\n'),
            video: song.links.find((link) => link.kind === 'video')?.url ?? '',
            sheet: song.links.find((link) => link.kind === 'sheet')?.url ?? '',
            mr: song.links.find((link) => link.kind === 'mr')?.url ?? '',
        };
    }
    return {
        owner: setlist.owner ?? '',
        status: setlist.status === 'confirmed' ? 'confirmed' : 'writing',
        order: songs.map((song) => song.songId),
        songs: drafts,
    };
}

export default function OrderScreen({ setlistId, onBack, onSelect }: { setlistId: string; onBack: () => void; onSelect: (id: string) => void }) {
    const { setlists, editor, roster } = useConti();
    const [picking, setPicking] = useState(false);
    const [draft, setDraft] = useState<SetlistDraft | null>(null);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const setlist = setlists.find((item) => item.id === setlistId) ?? null;

    if (!setlist) {
        return (
            <div className="space-y-6">
                <RoundIconButton label="콘티 내역으로" onClick={onBack}>
                    <ArrowLeft size={18} />
                </RoundIconButton>
                <p className={cn('py-10 text-center text-sm', sub)}>콘티를 찾을 수 없어요. 곡 보관함에서 삭제되었을 수 있어요.</p>
            </div>
        );
    }

    const songs = songsOf(setlist.items);
    const comments = commentsOf(setlist.items);
    const commenters = Array.from(new Set(comments.map((comment) => comment.author)));
    const choices = [...setlists].filter((item) => item.items.length > 0).sort((a, b) => b.date.localeCompare(a.date));
    const numbers = setlist.items.map((_, index) => songsOf(setlist.items.slice(0, index + 1)).length);
    const editing = draft !== null;
    const sessionHref = editor?.sessionHref?.(setlist.id);

    function startEdit() {
        if (!setlist) return;
        setDraft(draftFromSetlist(setlist));
        setMessage(null);
    }

    function save() {
        if (!editor || !draft || !setlist) return;
        const result = editor.saveSetlist(setlist.id, draft);
        if (result.ok) {
            setDraft(null);
            setMessage({ tone: 'ok', text: `저장했어요 · ${editor.storageNote}` });
        } else {
            setMessage({ tone: 'error', text: result.error });
        }
    }

    function updateSong(songId: string, patch: Partial<SongDraft>) {
        setDraft((current) => (current ? { ...current, songs: { ...current.songs, [songId]: { ...current.songs[songId], ...patch } } } : current));
    }

    function move(index: number, offset: number) {
        setDraft((current) => {
            if (!current) return current;
            const target = index + offset;
            if (target < 0 || target >= current.order.length) return current;
            const order = [...current.order];
            [order[index], order[target]] = [order[target], order[index]];
            return { ...current, order };
        });
    }

    const songById = new Map(songs.map((song) => [song.songId, song]));

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <RoundIconButton label="콘티 내역으로" onClick={onBack}>
                    <ArrowLeft size={18} />
                </RoundIconButton>
                <button type="button" onClick={() => setPicking((value) => !value)} aria-expanded={picking} disabled={editing} className="min-w-0 flex-1 text-left">
                    <Eyebrow>
                        {weekLabel(setlist.date)}
                        {setlist.owner ? ` · ${setlist.owner} 담당` : ''}
                    </Eyebrow>
                    <span className={cn('mt-0.5 flex items-center gap-1.5 text-[17px] font-semibold tracking-tight', ink)}>
                        {monthOf(setlist.date)}월 {dayOf(setlist.date)}일
                        <span className={cn('font-normal', sub)}>{weekday(setlist.date) === '일' ? '주일' : `${weekday(setlist.date)}요일`}</span>
                        {!editing && <ChevronDown size={18} className={cn('transition-transform', picking && 'rotate-180')} aria-hidden="true" />}
                    </span>
                </button>
                {editor ? (
                    !editing && (
                        <button type="button" onClick={startEdit} className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
                            <Pencil size={15} aria-hidden="true" />
                            편집
                        </button>
                    )
                ) : (
                    <AddButton label="곡 추가" />
                )}
            </header>

            {picking && !editing && (
                <ul className={cn('overflow-hidden rounded-2xl border animate-in fade-in slide-in-from-top-1 duration-150', line)}>
                    {choices.map((item) => (
                        <li key={item.id} className={cn('border-b last:border-b-0', line)}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(item.id);
                                    setPicking(false);
                                    setMessage(null);
                                }}
                                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left text-sm', item.id === setlist.id && 'bg-muted/60')}
                            >
                                <span className={cn('w-10 tabular-nums', sub)}>{md(item.date)}</span>
                                <span className={cn('flex-1 truncate font-medium', ink)}>{displayTitle(item)}</span>
                                <span className={cn('text-xs', SETLIST_STATUS[item.status].text)}>{SETLIST_STATUS[item.status].label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {message && (
                <p role="status" className={cn('rounded-2xl px-4 py-3 text-sm', message.tone === 'ok' ? STATUS.ok.soft : 'bg-destructive/10 text-destructive')}>
                    {message.text}
                </p>
            )}

            {editing && draft ? (
                <>
                    <section aria-label="콘티 정보 편집" className={cn('space-y-4 rounded-3xl border p-4', line)}>
                        <div>
                            <Eyebrow>{setlist.service}</Eyebrow>
                            <p className={cn('mt-0.5 text-lg font-semibold tracking-tight', ink)}>{displayTitle(setlist)}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="콘티 담당">
                                <input className={field} list="conti-roster" value={draft.owner} maxLength={40} placeholder="이름" onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
                            </Field>
                            <Field label="상태">
                                <div className={cn('grid h-10 grid-cols-2 gap-1 rounded-xl p-1', chip)} role="radiogroup" aria-label="콘티 상태">
                                    {(['writing', 'confirmed'] as const).map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            role="radio"
                                            aria-checked={draft.status === status}
                                            onClick={() => setDraft({ ...draft, status })}
                                            className={cn('rounded-lg text-xs font-semibold transition', draft.status === status ? 'bg-card text-foreground shadow-xs' : sub)}
                                        >
                                            {status === 'writing' ? '작성 중' : '확정'}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                        </div>
                        <p className={cn('text-xs leading-relaxed', sub)}>
                            {editor?.storageNote}
                            {!editor?.canReorder && ' · 서버에 저장된 콘티는 아직 곡 순서를 바꿀 수 없어요.'}
                        </p>
                        <EditActions onCancel={() => setDraft(null)} onSave={save} />
                    </section>

                    <datalist id="conti-roster">
                        {roster.map((name) => (
                            <option key={name} value={name} />
                        ))}
                    </datalist>

                    <ol aria-label="곡 편집" className="space-y-3">
                        {draft.order.map((songId, index) => {
                            const song = songById.get(songId);
                            const value = draft.songs[songId];
                            if (!song || !value) return null;
                            return (
                                <SongEditCard
                                    key={`${songId}-${index}`}
                                    song={song}
                                    number={index + 1}
                                    value={value}
                                    onChange={(patch) => updateSong(songId, patch)}
                                    onMove={editor?.canReorder ? (offset) => move(index, offset) : undefined}
                                    isFirst={index === 0}
                                    isLast={index === draft.order.length - 1}
                                />
                            );
                        })}
                    </ol>

                    <EditActions onCancel={() => setDraft(null)} onSave={save} />
                </>
            ) : (
                <>
                    <div>
                        <Eyebrow>
                            {setlist.theme.trim() ? `${setlist.service} · ` : ''}
                            <span className={SETLIST_STATUS[setlist.status].text}>{SETLIST_STATUS[setlist.status].label}</span>
                        </Eyebrow>
                        <h2 className={cn('mt-1 text-xl font-semibold tracking-tight', ink)}>{displayTitle(setlist)}</h2>
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <p className={cn('text-xs tabular-nums', sub)}>
                                {songs.length}곡 · Key {songs.map((item) => item.key || '-').join('·')}
                            </p>
                            {comments.length > 0 && (
                                <span className={cn('inline-flex items-center gap-1.5 text-xs', body)}>
                                    <AvatarStack names={commenters} max={3} size="xs" />
                                    코멘트 {comments.length}
                                </span>
                            )}
                        </div>
                    </div>

                    <ol aria-label={`${displayTitle(setlist)} 콘티 순서`} className="space-y-3">
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
                            return <SongCard key={item.id} song={item} number={numbers[index]} setlistId={setlist.id} />;
                        })}
                        {!songs.length && <li className={cn('py-8 text-center text-sm', sub)}>아직 곡이 없어요</li>}
                    </ol>

                    {sessionHref ? (
                        <Link href={sessionHref} className={cn(buttonVariants({ size: 'lg' }), 'w-full text-sm')}>
                            <Radio size={17} aria-hidden="true" />
                            이 콘티로 예배 열기
                        </Link>
                    ) : (
                        <button type="button" className={cn(buttonVariants({ size: 'lg' }), 'w-full text-sm')}>
                            <Radio size={17} aria-hidden="true" />
                            이 콘티로 예배 열기
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className={cn('mb-1.5 block text-[11px] font-medium', sub)}>{label}</span>
            {children}
        </label>
    );
}

function EditActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
    return (
        <div className="flex gap-2">
            <button type="button" onClick={onCancel} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
                취소
            </button>
            <button type="button" onClick={onSave} className={cn(buttonVariants(), 'flex-[2]')}>
                <Check size={16} aria-hidden="true" />
                저장
            </button>
        </div>
    );
}

function FormChip({ code, onRemove }: { code: string; onRemove?: () => void }) {
    const className = cn(
        'flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md px-1.5 text-[11px] font-semibold tabular-nums',
        code === 'C' || code === 'Tag' ? selected : code === 'B' ? cn('border border-foreground', ink) : cn(chip, body),
    );
    if (!onRemove) {
        return (
            <li title={SECTION_NAMES[code] ?? code} className={className}>
                {code}
            </li>
        );
    }
    return (
        <li>
            <button type="button" onClick={onRemove} aria-label={`${SECTION_NAMES[code] ?? code} 빼기`} className={className}>
                {code}
                <X size={10} aria-hidden="true" />
            </button>
        </li>
    );
}

function SongCard({ song, number, setlistId }: { song: ContiSong; number: number; setlistId: string }) {
    const { editor } = useConti();
    const [writing, setWriting] = useState(false);
    const [text, setText] = useState('');
    const [error, setError] = useState('');

    function submit(event: FormEvent) {
        event.preventDefault();
        if (!editor || !text.trim()) return;
        const result = editor.addComment(setlistId, song.songId, text);
        if (result.ok) {
            setText('');
            setWriting(false);
            setError('');
        } else {
            setError(result.error);
        }
    }

    return (
        <li className={cn('rounded-3xl border p-4', line)}>
            <div className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-px text-[15px] font-semibold tabular-nums text-muted-foreground/50">{String(number).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className={cn('text-[15px] font-semibold leading-snug', ink)}>{song.title}</h3>
                        <span className={cn('shrink-0 rounded-lg px-2 py-1 text-xs tabular-nums', chip, ink)}>
                            <KeyText from={song.originalKey} to={song.key} />
                        </span>
                    </div>
                    <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>
                        {[song.bpm ? `${song.bpm} BPM` : null, song.lead ? `리드 ${song.lead}` : null, song.artist].filter(Boolean).join(' · ') || 'BPM·리드 미정'}
                    </p>

                    <div className="mt-3.5">
                        <p className={cn('mb-1.5 text-[11px] font-medium', sub)}>송폼</p>
                        {song.form.length ? (
                            <ol aria-label="송폼" className="flex flex-wrap gap-1">
                                {song.form.map((code, index) => (
                                    <FormChip key={`${code}-${index}`} code={code} />
                                ))}
                            </ol>
                        ) : (
                            <p className={cn('text-xs', sub)}>아직 송폼이 없어요{editor ? ' · 편집에서 추가할 수 있어요' : ''}</p>
                        )}
                    </div>

                    {song.links.length > 0 && (
                        <ul aria-label="링크" className="mt-3 flex flex-wrap gap-1.5">
                            {song.links.map((link) => {
                                const Icon = LINK_ICON[link.kind];
                                const className = cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:bg-muted', line, ink);
                                const content = (
                                    <>
                                        <Icon size={14} aria-hidden="true" />
                                        {link.label}
                                        {link.fresh && <span className={cn('rounded-full px-1.5 text-[9px] font-bold leading-4', attention)}>NEW</span>}
                                    </>
                                );
                                return (
                                    <li key={`${link.kind}-${link.url ?? link.label}`}>
                                        {link.url ? (
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className={className}>
                                                {content}
                                            </a>
                                        ) : (
                                            <button type="button" className={className}>
                                                {content}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {song.notes.length > 0 && (
                        <div className={cn('mt-3 rounded-2xl px-3.5 py-3', TONE_BLOCK.peach)}>
                            <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold', TONE_ICON.peach)}>
                                <TriangleAlert size={13} aria-hidden="true" />
                                특이사항
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {song.notes.map((note, index) => (
                                    <li key={`${index}-${note}`} className={cn('flex gap-2 text-[13px] leading-relaxed', ink)}>
                                        <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {song.comments.length > 0 && (
                        <ul aria-label="팀원 코멘트" className={cn('mt-3.5 space-y-3 border-t pt-3.5', line)}>
                            {song.comments.map((comment, index) => (
                                <li key={comment.id ?? index} className="flex gap-2.5">
                                    <Avatar name={comment.author} size="sm" />
                                    <div className="min-w-0">
                                        <p className="text-xs">
                                            <span className={cn('font-semibold', ink)}>{comment.author}</span>
                                            <span className={cn('ml-1.5', sub)}>{comment.ago}</span>
                                        </p>
                                        <p className={cn('mt-0.5 whitespace-pre-line text-[13px] leading-relaxed', body)}>{comment.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {writing && editor ? (
                        <form onSubmit={submit} className="mt-3 space-y-2">
                            <div className={cn('flex h-11 items-center gap-2 rounded-full border pl-4 pr-1.5', line)}>
                                <input
                                    autoFocus
                                    value={text}
                                    maxLength={300}
                                    onChange={(event) => setText(event.target.value)}
                                    placeholder="코멘트 남기기…"
                                    aria-label={`${song.title} 코멘트`}
                                    className={cn('h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', ink)}
                                />
                                <button type="submit" disabled={!text.trim()} aria-label="코멘트 등록" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30', selected)}>
                                    <ArrowUp size={15} />
                                </button>
                            </div>
                            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                        </form>
                    ) : (
                        <button type="button" onClick={() => setWriting(true)} disabled={!editor} className={cn('mt-3 inline-flex h-8 items-center gap-1.5 text-xs font-medium', sub)}>
                            <MessageCircle size={14} aria-hidden="true" />
                            코멘트 남기기
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}

function SongEditCard({
    song,
    number,
    value,
    onChange,
    onMove,
    isFirst,
    isLast,
}: {
    song: ContiSong;
    number: number;
    value: SongDraft;
    onChange: (patch: Partial<SongDraft>) => void;
    onMove?: (offset: number) => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    return (
        <li className={cn('space-y-4 rounded-3xl border p-4', line)}>
            <div className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-px text-[15px] font-semibold tabular-nums text-muted-foreground/50">{String(number).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                    <h3 className={cn('text-[15px] font-semibold leading-snug', ink)}>{song.title}</h3>
                    <p className={cn('mt-0.5 text-xs', sub)}>원곡 Key {song.originalKey || '-'}</p>
                </div>
                {onMove && (
                    <div className="flex shrink-0 gap-1">
                        <button type="button" aria-label="위로" disabled={isFirst} onClick={() => onMove(-1)} className={cn('flex size-9 items-center justify-center rounded-full border disabled:opacity-30', line, ink)}>
                            <ArrowUp size={15} />
                        </button>
                        <button type="button" aria-label="아래로" disabled={isLast} onClick={() => onMove(1)} className={cn('flex size-9 items-center justify-center rounded-full border disabled:opacity-30', line, ink)}>
                            <ArrowDown size={15} />
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2">
                <Field label="이번 주 Key">
                    <select className={field} value={value.key} onChange={(event) => onChange({ key: event.target.value })}>
                        <option value={song.originalKey}>원곡 {song.originalKey || '-'}</option>
                        {COMMON_KEYS.filter((key) => key !== song.originalKey).map((key) => (
                            <option key={key} value={key}>
                                {key}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="BPM">
                    <input className={field} inputMode="numeric" value={value.bpm} placeholder="-" onChange={(event) => onChange({ bpm: event.target.value.replace(/[^\d]/g, '').slice(0, 3) })} />
                </Field>
                <Field label="리드">
                    <input className={field} list="conti-roster" value={value.lead} maxLength={40} placeholder="이름" onChange={(event) => onChange({ lead: event.target.value })} />
                </Field>
            </div>

            <div>
                <p className={cn('mb-1.5 text-[11px] font-medium', sub)}>송폼 · 칩을 누르면 빠져요</p>
                <ol aria-label="송폼" className="flex min-h-6 flex-wrap gap-1">
                    {value.form.map((code, index) => (
                        <FormChip key={`${code}-${index}`} code={code} onRemove={() => onChange({ form: value.form.filter((_, i) => i !== index) })} />
                    ))}
                    {!value.form.length && <li className={cn('text-xs', sub)}>아래에서 순서대로 눌러 추가하세요</li>}
                </ol>
                <div className="mt-2 flex flex-wrap gap-1">
                    {SECTION_PALETTE.map((code) => (
                        <button
                            key={code}
                            type="button"
                            disabled={value.form.length >= 100}
                            onClick={() => onChange({ form: [...value.form, code] })}
                            className={cn('h-8 rounded-lg border px-2.5 text-xs font-semibold', line, ink)}
                            title={SECTION_NAMES[code]}
                        >
                            +{code}
                        </button>
                    ))}
                    {value.form.length > 0 && (
                        <button type="button" onClick={() => onChange({ form: [] })} className={cn('h-8 rounded-lg px-2.5 text-xs font-medium', sub)}>
                            비우기
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <p className={cn('text-[11px] font-medium', sub)}>링크</p>
                <LinkInput icon={CirclePlay} label="원곡 영상 (YouTube)" value={value.video} onChange={(video) => onChange({ video })} />
                <LinkInput icon={FileText} label="악보 링크" value={value.sheet} onChange={(sheet) => onChange({ sheet })} />
                <LinkInput icon={Headphones} label="MR 링크" value={value.mr} onChange={(mr) => onChange({ mr })} />
            </div>

            <Field label="특이사항 · 한 줄에 하나씩">
                <textarea
                    className={cn(field, 'h-auto min-h-20 py-2.5 leading-relaxed')}
                    value={value.notes}
                    maxLength={1000}
                    rows={3}
                    placeholder="예: 드럼 4카운트 후 바로 진입"
                    onChange={(event) => onChange({ notes: event.target.value })}
                />
            </Field>
        </li>
    );
}

function LinkInput({ icon: Icon, label, value, onChange }: { icon: LucideIcon; label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className={cn('flex h-10 items-center gap-2 rounded-xl border border-input px-3 focus-within:ring-2 focus-within:ring-ring/30')}>
            <Icon size={15} className={sub} aria-hidden="true" />
            <span className="sr-only">{label}</span>
            <input type="url" inputMode="url" value={value} placeholder={label} onChange={(event) => onChange(event.target.value)} className={cn('h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', ink)} />
        </label>
    );
}
