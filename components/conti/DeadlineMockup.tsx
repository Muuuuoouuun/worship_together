'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { AlarmClock, Bell, BellRing, Check, CircleCheck, Clock, EyeOff, Hand, Inbox, ListMusic, Moon, ShieldAlert, Smartphone, Undo2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MEMBERS, SETLISTS, member } from './mockData';

/** 목업 팀원 id → 아바타에 넘길 이름·색 */
const person = (id: string | null | undefined) => {
    const found = member(id);
    return { name: found?.name ?? null, tone: found?.tone };
};
import { addDays, dayOf, diffDays, md, monthOf, weekLabel, weekday, type Tone } from './model';
import { Avatar, AvatarStack, Eyebrow, RoundIconButton, ScreenTitle, SectionTitle, TONE_BLOCK, TONE_ICON, body, chip, ink, line, selected, sub, todayText, tabOn, tabOff, ringCard, attentionText, divide } from './ui';

/**
 * 콘티 마감 알림 · 인도자 콘티 요청 목업 (docs/setlist-deadline-notifications.md).
 * 화면 상태만 시뮬레이션하며 저장하거나 알림을 보내지 않습니다.
 */
export type DeadlineView = 'member' | 'leader' | 'settings' | 'alerts';
export type DeadlinePhase = 'before' | 'soon' | 'overdue' | 'done';
type Nudge = { id: string; from: string | null; part: string; message: string; ago: string };

const SETLIST = SETLISTS.find((item) => item.id === 's1101') ?? SETLISTS[SETLISTS.length - 1];
/** 목업 콘티의 담당자는 이름으로 저장되어 있어 팀원 id 로 바꿔 씁니다. */
const LEADER = MEMBERS.find((item) => item.name === SETLIST.owner)?.id ?? 'm3';
const ME = 'm4';
const ME_PART = '건반';
const DEADLINE = tuesdayBefore(SETLIST.date);
const DEADLINE_TEXT = `${md(DEADLINE)} (화) 23:59`;
const SONGS = [
    { title: '주님 다시 오실 때까지', key: 'G' },
    { title: '시선', key: 'A' },
    { title: '은혜', key: 'D' },
    { title: '보내소서', key: 'A' },
];

const PHASES: Record<DeadlinePhase, { label: string; date: string; time: string; status: string; tone: Tone; text: string }> = {
    before: { label: '마감 전', date: addDays(DEADLINE, -1), time: '20:00', status: '마감까지 1일 4시간', tone: 'sky', text: 'text-sky-600 dark:text-sky-300' },
    soon: { label: '마감 임박', date: DEADLINE, time: '21:00', status: '마감까지 3시간', tone: 'sand', text: 'text-amber-600 dark:text-amber-400' },
    overdue: { label: '마감 지남', date: addDays(DEADLINE, 1), time: '12:00', status: '마감 12시간 지남', tone: 'peach', text: 'text-orange-600 dark:text-orange-400' },
    done: { label: '콘티 확정', date: addDays(DEADLINE, 1), time: '13:10', status: '마감 13시간 후 확정', tone: 'mint', text: 'text-emerald-600 dark:text-emerald-400' },
};

const OTHER_NUDGES: Nudge[] = [
    { id: 'n1', from: 'm7', part: '베이스', message: '곡 제목만 먼저 알려주셔도 좋아요', ago: '어제 18:20' },
    { id: 'n2', from: null, part: '이름 숨김', message: '콘티 언제쯤 올라올까요?', ago: '1시간 전' },
    { id: 'n3', from: 'm9', part: '음향', message: '자막·음향 큐를 미리 준비하고 싶어요', ago: '25분 전' },
];
const NUDGES_BY_PHASE: Record<DeadlinePhase, Nudge[]> = { before: [], soon: OTHER_NUDGES.slice(0, 1), overdue: OTHER_NUDGES, done: OTHER_NUDGES };
const PRESETS = ['콘티 언제쯤 올라올까요?', '미리 연습하고 싶어요', '곡 제목만 먼저 알려주셔도 좋아요', 'Key와 BPM이 궁금해요'];
const ETA_OPTIONS = [
    { id: 'tonight', label: '오늘 밤 안에 올릴게요', until: '오늘 23:59' },
    { id: 'morning', label: '내일 오전까지 올릴게요', until: '내일 12:00' },
    { id: 'titles', label: '곡 제목부터 먼저 공유할게요', until: '오늘 18:00' },
];
const TABS: { id: DeadlineView; label: string }[] = [
    { id: 'member', label: '팀원' },
    { id: 'leader', label: '인도자' },
    { id: 'settings', label: '마감 설정' },
    { id: 'alerts', label: '알림' },
];
const TOP_GLOW: CSSProperties = {
    backgroundImage: 'radial-gradient(90% 100% at 85% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 70%)',
};
const pill = cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition active:scale-95 disabled:opacity-40', line, ink);
const pillOn = cn('inline-flex h-8 items-center gap-1.5 rounded-full border border-transparent px-3 text-xs font-semibold transition active:scale-95', selected);
const mainButton = cn('flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-40', selected);
const bubble = cn('rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed', chip, body);

function tuesdayBefore(date: string): string {
    let day = addDays(date, -1);
    while (weekday(day) !== '화') day = addDays(day, -1);
    return day;
}

export default function DeadlineMockup({ initialView = 'member', initialPhase = 'overdue' }: { initialView?: DeadlineView; initialPhase?: DeadlinePhase }) {
    const [view, setView] = useState<DeadlineView>(initialView);
    const [phase, setPhase] = useState<DeadlinePhase>(initialPhase);
    const [myNudge, setMyNudge] = useState<{ message: string; anonymous: boolean } | null>(null);
    const [eta, setEta] = useState<string | null>(null);
    const nudges = [...NUDGES_BY_PHASE[phase], ...(myNudge && phase !== 'before' ? [{ id: 'me', from: myNudge.anonymous ? null : ME, part: myNudge.anonymous ? '이름 숨김' : ME_PART, message: myNudge.message, ago: '방금' }] : [])];
    const shared = { phase, nudges, myNudge, eta, openAlerts: () => setView('alerts') };

    return (
        <div className="relative isolate -mx-4 break-keep bg-card ring-border sm:mx-0 sm:rounded-[2rem] sm:shadow-sm sm:ring-1">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 sm:rounded-t-[2rem]" style={TOP_GLOW} />
            <div className="sticky top-[var(--app-header-h,0px)] z-20 border-b border-border/70 bg-card/90 backdrop-blur-md sm:rounded-t-[2rem] lg:top-0">
                <div role="tablist" aria-label="목업 화면" className="no-scrollbar flex gap-5 overflow-x-auto px-5 sm:px-8">
                    {TABS.map((tab) => {
                        const active = view === tab.id;
                        return (
                            <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setView(tab.id)} className={cn('relative -mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-2 text-sm transition', active ? tabOn : tabOff)}>
                                {tab.label}
                                {tab.id === 'leader' && nudges.length > 0 && phase !== 'done' && <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold tabular-nums text-secondary-foreground">{nudges.length}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-7 px-5 pb-10 pt-6 sm:px-8 sm:pt-8">
                {(view === 'member' || view === 'leader') && (
                    <div className="space-y-2">
                        <Eyebrow>시간을 바꿔 보기 · 지금 {md(PHASES[phase].date)} ({weekday(PHASES[phase].date)}) {PHASES[phase].time}</Eyebrow>
                        <div role="group" aria-label="시간 상태" className={cn('flex gap-1 rounded-full p-1', chip)}>
                            {(Object.keys(PHASES) as DeadlinePhase[]).map((key) => (
                                <button key={key} type="button" aria-pressed={phase === key} onClick={() => setPhase(key)} className={cn('h-8 flex-1 rounded-full text-xs transition', phase === key ? cn(selected, 'font-semibold') : sub)}>
                                    {PHASES[key].label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'member' && <MemberView {...shared} onNudge={setMyNudge} />}
                {view === 'leader' && <LeaderView {...shared} onEta={setEta} onConfirm={() => setPhase('done')} />}
                {view === 'settings' && <SettingsView />}
                {view === 'alerts' && <AlertsView />}
            </div>
        </div>
    );
}

type SharedProps = { phase: DeadlinePhase; nudges: Nudge[]; myNudge: { message: string; anonymous: boolean } | null; eta: string | null; openAlerts: () => void };

function Header({ eyebrow, phase, openAlerts }: { eyebrow: string; phase: DeadlinePhase; openAlerts: () => void }) {
    return (
        <ScreenTitle
            eyebrow={eyebrow}
            title={`${monthOf(SETLIST.date)}월 ${dayOf(SETLIST.date)}일`}
            trailing={`주일 · D-${diffDays(SETLIST.date, PHASES[phase].date)}`}
            aside={
                <span className="relative">
                    <RoundIconButton label="알림" onClick={openAlerts}>
                        <Bell size={18} />
                    </RoundIconButton>
                    {phase !== 'before' && <span className={cn('absolute right-2 top-2 size-2 rounded-full bg-secondary', ringCard)} aria-hidden="true" />}
                </span>
            }
        />
    );
}

/** 예배 주간(월~일)에 마감일과 지금 시각을 표시하는 날짜 줄 */
function WeekStrip({ phase }: { phase: DeadlinePhase }) {
    const now = PHASES[phase].date;
    const dates = Array.from({ length: 7 }, (_, index) => addDays(SETLIST.date, index - 6));
    return (
        <ol className="grid grid-cols-7 text-center" aria-label="예배 주간">
            {dates.map((date) => {
                const isNow = date === now;
                const isDeadline = date === DEADLINE;
                const isService = date === SETLIST.date;
                const past = diffDays(date, now) < 0;
                return (
                    <li key={date} className="flex flex-col items-center gap-2 py-1">
                        <span className={cn('text-xs', isNow ? cn('font-semibold', ink) : sub)}>{weekday(date)}</span>
                        <span className={cn('flex size-9 items-center justify-center rounded-xl text-[15px] tabular-nums', isNow ? cn(selected, 'font-semibold') : isDeadline ? cn('ring-1 ring-inset ring-secondary/40', PHASES[phase].text) : isService ? todayText : past ? 'text-muted-foreground/40' : body)}>
                            {dayOf(date)}
                        </span>
                        <span className={cn('h-3 text-[10px] font-medium', isDeadline ? attentionText : isService ? 'text-brand' : 'text-transparent')}>{isDeadline ? '마감' : isService ? '예배' : '·'}</span>
                    </li>
                );
            })}
        </ol>
    );
}

function AnonymousAvatar({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
    return <span title="이름 숨김" className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', ringCard, chip, sub, size === 'xs' ? 'size-5 text-[9px]' : size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-[11px]')}>?</span>;
}

function WaitingAvatars({ nudges }: { nudges: Nudge[] }) {
    const named = nudges.filter((nudge) => nudge.from).map((nudge) => nudge.from!);
    const hidden = nudges.length - named.length;
    return (
        <span className="flex items-center -space-x-1">
            <AvatarStack people={named.map(person)} max={3} size="xs" />
            {hidden > 0 && <AnonymousAvatar size="xs" />}
        </span>
    );
}

/** 이번 주 콘티 카드: 마감 상태에 따라 톤 블록 색과 문구가 바뀝니다. */
function SetlistCard({ phase, nudges, title, children }: { phase: DeadlinePhase; nudges: Nudge[]; title: string; children?: ReactNode }) {
    const info = PHASES[phase];
    const leader = member(LEADER);
    return (
        <section aria-label="이번 주 콘티" className={cn('rounded-3xl p-5', TONE_BLOCK[info.tone])}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Eyebrow>이번 주 콘티 · <span className={cn('font-semibold', info.text)}>{info.status}</span></Eyebrow>
                    <h2 className={cn('mt-1 text-lg font-semibold tracking-tight', ink)}>{title}</h2>
                    <p className={cn('mt-0.5 text-xs', sub)}>{SETLIST.service} · 오전 11:00</p>
                </div>
                {phase === 'done' ? <ListMusic size={20} className={TONE_ICON.mint} aria-hidden="true" /> : <AlarmClock size={20} className={TONE_ICON[info.tone]} aria-hidden="true" />}
            </div>

            {phase === 'done' ? (
                <ol className="mt-4 space-y-2">
                    {SONGS.map((song, index) => (
                        <li key={song.title} className="flex items-center gap-3 text-[13px]">
                            <span className={cn('w-3 tabular-nums', sub)}>{index + 1}</span>
                            <span className={cn('min-w-0 flex-1 truncate', ink)}>{song.title}</span>
                            <span className={cn('shrink-0 text-xs tabular-nums', sub)}>Key {song.key}</span>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className={cn('mt-4 flex items-center gap-1.5 text-[13px]', body)}>
                    <Clock size={14} aria-hidden="true" />
                    마감 {DEADLINE_TEXT}
                </p>
            )}
            {children}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3.5">
                <span className={cn('inline-flex items-center gap-2 text-xs', body)}>
                    {phase === 'done' ? `${SONGS.length}곡 · ${DEADLINE_TEXT} 마감` : nudges.length ? <><WaitingAvatars nudges={nudges} />{nudges.length}명이 기다리는 중</> : '아직 요청 없음'}
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className={cn('text-xs', sub)}>담당</span>
                    <Avatar {...person(LEADER)} size="sm" />
                    <span className={cn('text-xs font-medium', ink)}>{leader?.name}</span>
                </span>
            </div>
        </section>
    );
}

function MemberView({ phase, nudges, myNudge, eta, openAlerts, onNudge }: SharedProps & { onNudge: (nudge: { message: string; anonymous: boolean } | null) => void }) {
    const leader = member(LEADER);
    const etaOption = phase === 'overdue' ? ETA_OPTIONS.find((option) => option.id === eta) : undefined;
    const titles: Record<DeadlinePhase, string> = { before: '콘티를 준비하고 있어요', soon: '곧 콘티가 올라와요', overdue: '콘티가 아직 없어요', done: '주님 오실 때까지' };
    return (
        <div className="space-y-7">
            <Header eyebrow={`${weekLabel(SETLIST.date)} · 내 파트 ${ME_PART}`} phase={phase} openAlerts={openAlerts} />
            <WeekStrip phase={phase} />
            <SetlistCard phase={phase} nudges={nudges} title={titles[phase]} />

            {etaOption && (
                <div className={cn('flex gap-3.5 border-b pb-5', line)}>
                    <Avatar {...person(LEADER)} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug"><span className={cn('font-semibold', ink)}>{leader?.name}</span><span className={body}>님이 예정 시간을 알려줬어요</span></p>
                        <p className={cn('mt-2', bubble)}>{etaOption.label}</p>
                        <p className={cn('mt-1.5 text-[11px]', sub)}>방금 · 예정 {etaOption.until}까지 요청을 잠시 멈춰요</p>
                    </div>
                </div>
            )}

            {phase === 'done' ? (
                myNudge && <p className={cn('flex items-center gap-1.5 text-sm', body)}><CircleCheck size={16} className={TONE_ICON.mint} /> 보낸 요청은 자동으로 완료됐어요</p>
            ) : (
                <section aria-label="인도자에게 콘티 요청" className="space-y-3">
                    <SectionTitle title={`${leader?.name}님께 콘티 요청`} meta="3시간에 한 번" />
                    {phase !== 'overdue' && <p className={cn('text-xs leading-5', sub)}>아직 마감({DEADLINE_TEXT}) 전이에요. 급하지 않다면 마감까지 기다려 주세요.</p>}
                    {myNudge ? <SentNudge nudge={myNudge} onCancel={() => onNudge(null)} /> : etaOption ? <p className={cn('py-2 text-sm', sub)}>예정 시간까지는 요청할 수 없어요.</p> : <NudgeComposer onSend={onNudge} />}
                </section>
            )}

            <section aria-label="요청 전달 방식" className={cn('rounded-3xl p-5', chip)}>
                <p className={cn('text-sm font-semibold', ink)}>요청은 이렇게 전달돼요</p>
                <ol className={cn('mt-2 space-y-1.5 text-xs leading-5', body)}>
                    <li><span className={sub}>1</span>&ensp;여러 팀원의 요청은 묶어서 인도자에게 한 번에 가요.</li>
                    <li><span className={sub}>2</span>&ensp;인도자가 예정 시간을 알려주면 기다리는 팀원 모두에게 공유돼요.</li>
                    <li><span className={sub}>3</span>&ensp;콘티가 확정되면 보낸 요청은 자동으로 완료돼요.</li>
                </ol>
            </section>
        </div>
    );
}

function NudgeComposer({ onSend }: { onSend: (nudge: { message: string; anonymous: boolean }) => void }) {
    const [preset, setPreset] = useState(PRESETS[0]);
    const [extra, setExtra] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="보낼 말">
                {PRESETS.map((item) => (
                    <button key={item} type="button" aria-pressed={preset === item} onClick={() => setPreset(item)} className={preset === item ? pillOn : pill}>{item}</button>
                ))}
            </div>
            <label className={cn('flex h-11 items-center gap-2 rounded-full border pl-4 pr-1.5', line)}>
                <span className="sr-only">덧붙일 말</span>
                <input value={extra} onChange={(event) => setExtra(event.target.value)} maxLength={200} placeholder="덧붙일 말 (선택)" className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', ink)} />
            </label>
            <SwitchRow checked={anonymous} onChange={setAnonymous} icon={EyeOff} label="이름 숨기고 보내기" detail="인도자에게 ‘팀원 1명’으로 보여요" />
            <button type="button" className={mainButton} onClick={() => onSend({ message: extra.trim() ? `${preset} ${extra.trim()}` : preset, anonymous })}>
                <Hand size={16} aria-hidden="true" /> 요청 보내기
            </button>
        </div>
    );
}

function SentNudge({ nudge, onCancel }: { nudge: { message: string; anonymous: boolean }; onCancel: () => void }) {
    return (
        <div className="flex gap-3.5 animate-in fade-in duration-150">
            {nudge.anonymous ? <AnonymousAvatar size="md" /> : <Avatar {...person(ME)} size="md" />}
            <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug"><span className={cn('font-semibold', ink)}>요청을 보냈어요</span>{nudge.anonymous && <span className={sub}> · 이름 숨김</span>}</p>
                <p className={cn('mt-2', bubble)}>{nudge.message}</p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className={cn('text-[11px]', sub)}>방금 · 3시간 뒤 다시 요청할 수 있어요</span>
                    <button type="button" onClick={onCancel} className={pill}><Undo2 size={13} aria-hidden="true" /> 요청 취소</button>
                </div>
            </div>
        </div>
    );
}

function LeaderView({ phase, nudges, eta, openAlerts, onEta, onConfirm }: SharedProps & { onEta: (eta: string | null) => void; onConfirm: () => void }) {
    const etaOption = ETA_OPTIONS.find((option) => option.id === eta);
    const titles: Record<DeadlinePhase, string> = { before: '내일까지 콘티를 올려 주세요', soon: '마감 3시간 전이에요', overdue: '콘티 마감이 지났어요', done: '주님 오실 때까지' };
    return (
        <div className="space-y-7">
            <Header eyebrow={`${weekLabel(SETLIST.date)} · 인도`} phase={phase} openAlerts={openAlerts} />
            <WeekStrip phase={phase} />
            <SetlistCard phase={phase} nudges={nudges} title={titles[phase]}>
                {phase === 'done' ? (
                    <p className={cn('mt-3 text-xs', body)}>팀원 6명에게 알림을 보냈고, 받은 요청 {nudges.length}건은 자동으로 완료됐어요.</p>
                ) : (
                    <div className="mt-4 flex gap-2">
                        <button type="button" onClick={onConfirm} className={cn('h-10 flex-1 rounded-xl text-sm font-semibold transition active:scale-[0.99]', selected)}>콘티 작성하기</button>
                        <button type="button" onClick={onConfirm} className="h-10 flex-1 rounded-xl bg-card/70 text-sm font-medium text-foreground ring-1 ring-foreground/10 transition active:scale-[0.99]">곡 제목만 먼저</button>
                    </div>
                )}
            </SetlistCard>
            {phase !== 'done' && <p className={cn('-mt-4 text-[11px]', sub)}>목업에서는 누르면 ‘콘티 확정’ 상태로 바뀌어요.</p>}

            {phase !== 'done' && (
                <section aria-label="기다리는 팀원" className="space-y-1">
                    <SectionTitle title="기다리는 팀원" meta={nudges.length ? `${nudges.length}명 · 3시간마다 묶어서 알림` : undefined} />
                    <ul>
                        {nudges.map((nudge) => (
                            <li key={nudge.id} className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
                                {nudge.from ? <Avatar {...person(nudge.from)} size="md" /> : <AnonymousAvatar size="md" />}
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-snug"><span className={cn('font-semibold', ink)}>{nudge.from ? member(nudge.from)?.name : '팀원 1명'}</span><span className={sub}> · {nudge.part}</span></p>
                                    <p className={cn('mt-2', bubble)}>{nudge.message}</p>
                                    <p className={cn('mt-1.5 text-[11px]', sub)}>{nudge.ago}</p>
                                </div>
                            </li>
                        ))}
                        {!nudges.length && <li className={cn('py-8 text-center text-sm', sub)}>아직 요청이 없어요</li>}
                    </ul>
                </section>
            )}

            {phase !== 'done' && nudges.length > 0 && (
                <section aria-label="예정 시간 알려주기" className="space-y-3">
                    <SectionTitle title="예정 시간 알려주기" />
                    <p className={cn('text-xs leading-5', sub)}>기다리는 팀원 모두에게 전달되고, 그 시간까지 요청과 마감 알림을 멈춰요.</p>
                    <div className="flex flex-wrap gap-1.5">
                        {ETA_OPTIONS.map((option) => (
                            <button key={option.id} type="button" aria-pressed={eta === option.id} onClick={() => onEta(eta === option.id ? null : option.id)} className={eta === option.id ? pillOn : pill}>{option.label}</button>
                        ))}
                    </div>
                    {etaOption && <p role="status" className={cn('flex items-start gap-1.5 text-xs font-medium', TONE_ICON.mint)}><Check size={14} className="mt-0.5 shrink-0" /> 팀원 {nudges.length}명에게 전달했어요 · {etaOption.until}까지 알림 멈춤</p>}
                </section>
            )}

            <section aria-label="다가오는 콘티 마감" className="space-y-1">
                <SectionTitle title="다가오는 콘티 마감" />
                <ul className={divide}>
                    {[
                        { date: SETLIST.date, owner: LEADER, status: PHASES[phase].status, text: PHASES[phase].text },
                        { date: addDays(SETLIST.date, 7), owner: 'm1', status: '미작성', text: sub },
                        { date: addDays(SETLIST.date, 14), owner: 'm2', status: '미작성', text: sub },
                    ].map((item) => (
                        <li key={item.date} className="flex items-center gap-3.5 py-4">
                            <Avatar {...person(item.owner)} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className={cn('text-[15px] font-medium', ink)}>{md(item.date)} {SETLIST.service}</p>
                                <p className={cn('mt-0.5 text-xs tabular-nums', sub)}>마감 {md(tuesdayBefore(item.date))} (화) 23:59</p>
                            </div>
                            <span className={cn('shrink-0 text-xs font-semibold', item.text)}>{item.status}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function SwitchRow({ checked, onChange, icon: Icon, label, detail, children }: { checked: boolean; onChange: (value: boolean) => void; icon?: LucideIcon; label: string; detail?: string; children?: ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            {Icon && <Icon size={17} className={cn('mt-0.5 shrink-0', sub)} aria-hidden="true" />}
            <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', ink)}>{label}</p>
                {detail && <p className={cn('mt-0.5 text-xs leading-5', sub)}>{detail}</p>}
                {children}
            </div>
            <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-input')}>
                <span className={cn('absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all', checked ? 'left-[1.125rem]' : 'left-0.5')} />
            </button>
        </div>
    );
}

const WEEKDAY_OPTIONS = ['월', '화', '수', '목', '금', '토'];
const DEADLINE_RULES = [
    { id: 'tue', label: '예배 전 화요일 23:59' },
    { id: 'd3', label: '예배 3일 전 22:00' },
    { id: 'd2', label: '예배 2일 전 21:00' },
    { id: 'custom', label: '직접 정하기' },
];
const BEFORE_OPTIONS = ['하루 전 21:00', '3시간 전', '1시간 전', '마감 시각'];
const selectBox = cn('h-9 rounded-full border bg-transparent px-3 text-xs font-medium', line, ink);

function weekdayBefore(date: string, target: string): string {
    let day = addDays(date, -1);
    while (weekday(day) !== target) day = addDays(day, -1);
    return day;
}

function SettingsView() {
    const [rule, setRule] = useState('tue');
    const [customDay, setCustomDay] = useState('수');
    const [customTime, setCustomTime] = useState('22:00');
    const [before, setBefore] = useState(['하루 전 21:00', '3시간 전']);
    const [toLeader, setToLeader] = useState(true);
    const [toTeam, setToTeam] = useState(true);
    const [toAdmin, setToAdmin] = useState(true);
    const [adminHours, setAdminHours] = useState(12);
    const [early, setEarly] = useState(true);
    const [cooldown, setCooldown] = useState(3);
    const [anonymous, setAnonymous] = useState(true);
    const [quiet, setQuiet] = useState(true);
    const [push, setPush] = useState(true);
    const example = rule === 'tue' ? `${md(DEADLINE)} (화) 23:59`
        : rule === 'd3' ? `${md(addDays(SETLIST.date, -3))} (${weekday(addDays(SETLIST.date, -3))}) 22:00`
            : rule === 'd2' ? `${md(addDays(SETLIST.date, -2))} (${weekday(addDays(SETLIST.date, -2))}) 21:00`
                : `${md(weekdayBefore(SETLIST.date, customDay))} (${customDay}) ${customTime}`;

    return (
        <div className="space-y-8">
            <ScreenTitle eyebrow="팀 관리자" title="콘티 마감 설정" />

            <section className="space-y-3">
                <SectionTitle title="콘티 마감" />
                <div className="flex flex-wrap gap-1.5">
                    {DEADLINE_RULES.map((item) => <button key={item.id} type="button" aria-pressed={rule === item.id} onClick={() => setRule(item.id)} className={rule === item.id ? pillOn : pill}>{item.label}</button>)}
                </div>
                {rule === 'custom' && (
                    <div className={cn('flex flex-wrap items-center gap-2 text-xs', body)}>
                        예배 전
                        <select className={selectBox} value={customDay} onChange={(event) => setCustomDay(event.target.value)}>{WEEKDAY_OPTIONS.map((day) => <option key={day} value={day}>{day}요일</option>)}</select>
                        <input type="time" className={selectBox} value={customTime} onChange={(event) => setCustomTime(event.target.value)} />
                        까지
                    </div>
                )}
                <p className={cn(bubble, 'rounded-tl-2xl')}>{md(SETLIST.date)} 주일 예배라면 <span className={cn('font-semibold', ink)}>{example}</span>까지 올려야 해요. 일정마다 따로 바꿀 수 있어요.</p>
            </section>

            <section className="space-y-3">
                <SectionTitle title="마감 전 인도자 알림" />
                <div className="flex flex-wrap gap-1.5">
                    {BEFORE_OPTIONS.map((item) => {
                        const on = before.includes(item);
                        return <button key={item} type="button" aria-pressed={on} onClick={() => setBefore((list) => (on ? list.filter((value) => value !== item) : [...list, item]))} className={on ? pillOn : pill}>{item}</button>;
                    })}
                </div>
            </section>

            <section className="space-y-5">
                <SectionTitle title="마감이 지나면" />
                <SwitchRow checked={toLeader} onChange={setToLeader} icon={AlarmClock} label="인도자에게 긴급 알림" detail="밤 시간이면 아침 7시에 보내요" />
                <SwitchRow checked={toTeam} onChange={setToTeam} icon={Bell} label="배정된 팀원에게 안내" detail="‘아직 콘티가 올라오지 않았어요’와 요청 버튼" />
                <SwitchRow checked={toAdmin} onChange={setToAdmin} icon={ShieldAlert} label="팀 관리자에게 알림">
                    {toAdmin && (
                        <label className={cn('mt-2 flex items-center gap-2 text-xs', body)}>
                            마감 후
                            <select className={selectBox} value={adminHours} onChange={(event) => setAdminHours(Number(event.target.value))}>{[6, 12, 24].map((hour) => <option key={hour} value={hour}>{hour}시간</option>)}</select>
                            지나도 없으면
                        </label>
                    )}
                </SwitchRow>
            </section>

            <section className="space-y-5">
                <SectionTitle title="팀원 요청" />
                <SwitchRow checked={early} onChange={setEarly} icon={Hand} label="마감 전에도 요청 허용" detail="마감 전에는 버튼만 보이고 경고는 띄우지 않아요" />
                <div className="flex items-start gap-3">
                    <Clock size={17} className={cn('mt-0.5 shrink-0', sub)} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium', ink)}>같은 팀원 재요청 간격</p>
                        <p className={cn('mt-0.5 text-xs leading-5', sub)}>인도자 알림도 이 간격으로 묶여요</p>
                    </div>
                    <select className={selectBox} value={cooldown} onChange={(event) => setCooldown(Number(event.target.value))}>{[1, 3, 6].map((hour) => <option key={hour} value={hour}>{hour}시간</option>)}</select>
                </div>
                <SwitchRow checked={anonymous} onChange={setAnonymous} icon={EyeOff} label="이름 숨김 요청 허용" detail="인도자·관리자 모두에게 ‘팀원 1명’으로 보여요" />
                <SwitchRow checked={quiet} onChange={setQuiet} icon={Moon} label="밤 시간 알림 모아두기" detail="23:00–07:00 알림은 아침 7시에 한 번에" />
            </section>

            <section className="space-y-4">
                <SectionTitle title="휴대폰 알림" />
                <SwitchRow checked={push} onChange={setPush} icon={Smartphone} label="앱을 닫아도 알림 받기" detail="Android·PC 크롬은 바로, iPhone은 홈 화면에 추가하면 받을 수 있어요" />
                {push && <button type="button" className={pill}><BellRing size={13} aria-hidden="true" /> 이 기기에서 알림 허용하기</button>}
            </section>

            <section className={cn('rounded-3xl p-5', chip)}>
                <p className={cn('text-sm font-semibold', ink)}>이렇게 동작해요</p>
                <ul className={cn('mt-2 space-y-1.5 text-xs leading-5', body)}>
                    <li>· 콘티 마감 {example}</li>
                    <li>· 인도자 미리 알림 {before.length ? BEFORE_OPTIONS.filter((item) => before.includes(item)).join(', ') : '없음'}</li>
                    <li>· 마감 후 {[toLeader && '인도자 긴급 알림', toTeam && '팀원 안내', toAdmin && `${adminHours}시간 뒤 관리자 알림`].filter(Boolean).join(' · ') || '추가 알림 없음'}</li>
                    <li>· 팀원 요청 {early ? '언제든' : '마감 후부터'} · {cooldown}시간 간격{anonymous ? ' · 이름 숨김 가능' : ''}{quiet ? ' · 밤에는 모아서' : ''}</li>
                    <li>· 휴대폰 알림 {push ? '켜짐' : '꺼짐 (앱 안에서만)'}</li>
                </ul>
                <button type="button" disabled className={cn(mainButton, 'mt-4')}>저장 (목업)</button>
            </section>
        </div>
    );
}

type Alert = { id: string; actor: string | null; icon: LucideIcon; tone: Tone; who?: string; message: string; quote?: string; time: string; action?: string; urgent?: boolean };
type Audience = 'leader' | 'member' | 'admin';
const DAY_GROUPS = [
    { label: `오늘 · ${md(addDays(DEADLINE, 1))} (수)`, date: addDays(DEADLINE, 1) },
    { label: `어제 · ${md(DEADLINE)} (화)`, date: DEADLINE },
    { label: `${md(addDays(DEADLINE, -1))} (월)`, date: addDays(DEADLINE, -1) },
];
const ALERTS: Record<Audience, (Alert & { date: string })[]> = {
    leader: [
        { id: 'l5', date: addDays(DEADLINE, 1), actor: 'm9', icon: Hand, tone: 'peach', who: '서하늘', message: '님 외 1명이 콘티를 요청했어요', quote: '자막·음향 큐를 미리 준비하고 싶어요', time: '12:00', action: '요청 보기' },
        { id: 'l4', date: addDays(DEADLINE, 1), actor: null, icon: AlarmClock, tone: 'peach', message: '콘티 마감이 지났어요', quote: '밤 시간이라 아침에 알려드려요. 예정 시간을 알려주면 팀원들이 덜 기다려요.', time: '07:00', action: '예정 시간 알리기', urgent: true },
        { id: 'l3', date: DEADLINE, actor: null, icon: Clock, tone: 'sand', message: '콘티 마감 3시간 전이에요', quote: '곡 제목만 먼저 올려도 팀원들이 연습을 시작할 수 있어요.', time: '21:00', action: '콘티 작성' },
        { id: 'l2', date: DEADLINE, actor: 'm7', icon: Hand, tone: 'peach', who: '윤사랑', message: '님이 콘티를 요청했어요', quote: '곡 제목만 먼저 알려주셔도 좋아요', time: '18:20' },
        { id: 'l1', date: addDays(DEADLINE, -1), actor: null, icon: Clock, tone: 'sky', message: '콘티 마감 하루 전이에요', quote: `${md(SETLIST.date)} ${SETLIST.service} 콘티를 내일(화) 23:59까지 올려 주세요.`, time: '21:00', action: '콘티 작성' },
    ],
    member: [
        { id: 'm3', date: addDays(DEADLINE, 1), actor: LEADER, icon: CircleCheck, tone: 'mint', who: member(LEADER)?.name, message: `님이 ${md(SETLIST.date)} 콘티를 확정했어요`, quote: '보낸 요청은 자동으로 완료됐어요.', time: '13:10', action: '콘티 보기' },
        { id: 'm2', date: addDays(DEADLINE, 1), actor: LEADER, icon: Clock, tone: 'sky', who: member(LEADER)?.name, message: '님이 예정 시간을 알려줬어요', quote: '오늘 밤 안에 올릴게요', time: '12:05' },
        { id: 'm1', date: addDays(DEADLINE, 1), actor: null, icon: AlarmClock, tone: 'peach', message: '아직 콘티가 올라오지 않았어요', quote: `마감(${DEADLINE_TEXT})이 지났어요. 인도자에게 요청할 수 있어요.`, time: '07:00', action: '콘티 요청하기' },
    ],
    admin: [
        { id: 'a1', date: addDays(DEADLINE, 1), actor: null, icon: ShieldAlert, tone: 'peach', message: '콘티 미등록 12시간이 지났어요', quote: `${md(SETLIST.date)} ${SETLIST.service} · 담당 ${member(LEADER)?.name} · 팀원 요청 3건`, time: '12:00', action: `${member(LEADER)?.name}님께 연락`, urgent: true },
    ],
};
const AUDIENCES: { id: Audience; label: string }[] = [
    { id: 'leader', label: '인도자' },
    { id: 'member', label: '팀원' },
    { id: 'admin', label: '관리자' },
];

function AlertsView() {
    const [audience, setAudience] = useState<Audience>('leader');
    const [read, setRead] = useState<string[]>([]);
    const items = ALERTS[audience];
    const push = items.find((item) => item.urgent) ?? items[0];
    return (
        <div className="space-y-6">
            <ScreenTitle eyebrow="알림" title="받는 알림 미리보기" trailing={`${md(addDays(DEADLINE, 1))} (수) 기준`} />
            <div role="tablist" aria-label="받는 사람" className={cn('flex gap-6 border-b', line)}>
                {AUDIENCES.map((item) => {
                    const active = item.id === audience;
                    return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setAudience(item.id)} className={cn('-mb-px h-11 border-b-2 text-sm transition', active ? tabOn : tabOff)}>{item.label}</button>;
                })}
            </div>

            <section aria-label="잠금 화면 알림" className="rounded-3xl bg-gradient-to-br from-sky-100 via-violet-50 to-orange-50 p-4 dark:from-sky-400/15 dark:via-violet-400/10 dark:to-orange-400/10">
                <Eyebrow className="px-1">앱을 닫았을 때 · 잠금 화면</Eyebrow>
                <div className="mt-2 flex gap-3 rounded-2xl bg-card/85 p-3.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">W</span>
                    <div className="min-w-0 flex-1">
                        <p className={cn('flex justify-between gap-2 text-[11px]', sub)}><span>Worship Together</span><span>{push.time}</span></p>
                        <p className={cn('mt-0.5 truncate text-[13px] font-semibold', ink)}>{push.who ? `${push.who}${push.message}` : push.message}</p>
                        {push.quote && <p className={cn('line-clamp-2 text-xs leading-snug', body)}>{push.quote}</p>}
                    </div>
                </div>
            </section>

            {DAY_GROUPS.map((group) => {
                const rows = items.filter((item) => item.date === group.date);
                if (!rows.length) return null;
                return (
                    <section key={group.date} aria-label={group.label}>
                        <Eyebrow>{group.label}</Eyebrow>
                        <ul className="mt-1">
                            {rows.map((item) => {
                                const unread = !read.includes(item.id);
                                return (
                                    <li key={item.id} className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
                                        <span className="relative inline-flex shrink-0 self-start">
                                            {item.actor ? <Avatar {...person(item.actor)} size="md" /> : <span className={cn('flex size-9 items-center justify-center rounded-full', TONE_BLOCK[item.tone])}><item.icon size={16} className={TONE_ICON[item.tone]} aria-hidden="true" /></span>}
                                            {item.actor && (
                                                <span className="absolute -bottom-1 -right-1 flex size-[1.125rem] items-center justify-center rounded-full bg-card ring-2 ring-card">
                                                    <span className={cn('flex size-full items-center justify-center rounded-full', TONE_BLOCK[item.tone])}><item.icon size={10} strokeWidth={2.5} className={TONE_ICON[item.tone]} aria-hidden="true" /></span>
                                                </span>
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <button type="button" onClick={() => setRead((list) => [...list, item.id])} className="block w-full text-left">
                                                <p className="text-sm leading-snug">
                                                    {item.urgent && <span className={cn('font-semibold', attentionText)}>긴급 · </span>}
                                                    {item.who ? <><span className={cn('font-semibold', ink)}>{item.who}</span><span className={body}>{item.message}</span></> : <span className={cn('font-semibold', ink)}>{item.message}</span>}
                                                </p>
                                                {item.quote && <p className={cn('mt-2', bubble)}>{item.quote}</p>}
                                                <p className={cn('mt-1.5 text-[11px]', sub)}>{item.time}</p>
                                            </button>
                                            {item.action && <button type="button" className={cn(pill, 'mt-2.5 font-semibold')}>{item.action}</button>}
                                        </div>
                                        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-secondary' : 'bg-transparent')} aria-label={unread ? '읽지 않음' : undefined} />
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}

            <p className={cn('flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs leading-5', line, sub)}>
                <Inbox size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                앱 안에서는 팀 소식·배지·배너로, 앱을 닫았을 때는 휴대폰 알림으로 같은 내용을 받아요. 밤 23:00–07:00 알림은 아침에 모아서 보내요.
            </p>
        </div>
    );
}
