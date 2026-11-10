'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlarmClock, CircleCheck, Clock, EyeOff, Hand, Settings2, Undo2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { DEFAULT_DEADLINE_SETTINGS, REMINDER_LABEL, WEEKDAY_LABEL, nudgePresets, type DeadlineSettings, type ReminderKey } from '@/lib/contiDeadline';
import { addDays } from './model';
import { useConti } from './context';
import type { DeadlineCardView, DeadlineNudge } from './planningBridge';
import { PlanningError, pill, pillOn, useDispatch } from './planningUi';
import { Avatar, AvatarStack, Eyebrow, SectionTitle, TONE_BLOCK, TONE_ICON, body, chip, ink, line, ringCard, sub } from './ui';
import type { Tone } from './model';

/*
 * 콘티 마감 카드 (docs/setlist-deadline-notifications.md).
 * - 팀원: 마감 상태 · 기다리는 사람 · 인도자에게 콘티 요청(이름 숨김 가능) · 인도자가 알려준 예정 시간
 * - 인도자: 받은 요청 · 예정 시간 알려주기 · 콘티 작성으로 가기 · 이 예배만 마감 바꾸기
 * - 관리자: 팀 마감 설정
 */

const STAGE_TONE: Record<DeadlineCardView['stage'], { tone: Tone; text: string }> = {
    before: { tone: 'sky', text: 'text-sky-700 dark:text-sky-300' },
    soon: { tone: 'sand', text: 'text-amber-700 dark:text-amber-400' },
    overdue: { tone: 'peach', text: 'text-orange-700 dark:text-orange-400' },
    met: { tone: 'mint', text: 'text-emerald-700 dark:text-emerald-400' },
};
const bubble = cn('rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13px] leading-relaxed', chip, body);
const selectBox = cn('h-9 rounded-full border bg-transparent px-3 text-xs font-medium', line, ink);

export default function DeadlineCard({ deadline, openOrder }: { deadline: DeadlineCardView | null; openOrder: (setlistId: string) => void }) {
    const { planning } = useConti();
    const [settingsOpen, setSettingsOpen] = useState(false);
    if (!deadline && !planning.canEditDeadline) return null;
    if (!planning.deadlineSettings.enabled && !planning.canEditDeadline) return null;
    const settingsButton = planning.canEditDeadline ? (
        <button type="button" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen} className={cn('inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline', body)}>
            <Settings2 size={13} aria-hidden="true" /> 마감 설정
        </button>
    ) : null;

    return (
        <section aria-label="콘티 마감" className="space-y-3">
            <SectionTitle title="콘티 마감" meta={deadline ? deadline.deadlineText : undefined} action={settingsButton} />
            {settingsOpen && <DeadlineSettingsPanel onDone={() => setSettingsOpen(false)} />}
            {!planning.deadlineSettings.enabled ? (
                <p className={cn('text-xs', sub)}>콘티 마감 알림이 꺼져 있어요.</p>
            ) : deadline ? (
                <>
                    <Status deadline={deadline} />
                    {deadline.stage !== 'met' && (deadline.isLeader ? <LeaderPanel deadline={deadline} openOrder={openOrder} /> : <MemberPanel deadline={deadline} />)}
                    <PlanningError />
                </>
            ) : (
                <p className={cn('text-xs', sub)}>다가오는 예배가 없어요.</p>
            )}
        </section>
    );
}

function Status({ deadline }: { deadline: DeadlineCardView }) {
    const tone = STAGE_TONE[deadline.stage];
    const Icon = deadline.stage === 'met' ? CircleCheck : AlarmClock;
    const headline = deadline.stage === 'met' ? '콘티가 확정됐어요'
        : deadline.status === 'draft' ? '초안이 올라와 있어요 · 확정 전'
            : deadline.status === 'none' || deadline.songCount === 0 ? (deadline.stage === 'overdue' ? '콘티가 아직 없어요' : '콘티를 준비하고 있어요')
                : '콘티를 작성하고 있어요';
    return (
        <div className={cn('rounded-3xl p-5', TONE_BLOCK[tone.tone])}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Eyebrow>
                        {deadline.title} · <span className={cn('font-semibold', tone.text)}>{deadline.stageText}</span>
                    </Eyebrow>
                    <p className={cn('mt-1 text-[17px] font-semibold tracking-tight', ink)}>{headline}</p>
                    <p className={cn('mt-1 flex items-center gap-1.5 text-xs', body)}>
                        <Clock size={13} aria-hidden="true" />
                        마감 {deadline.deadlineText}{deadline.overridden ? ' · 이 예배만 따로 정함' : ''}
                    </p>
                </div>
                <Icon size={20} className={TONE_ICON[tone.tone]} aria-hidden="true" />
            </div>
            {deadline.eta && deadline.stage !== 'met' && (
                <p className={cn('mt-3 rounded-2xl bg-card/70 px-3.5 py-2.5 text-[13px]', body)}>
                    <span className={cn('font-semibold', ink)}>{deadline.eta.byName ?? '인도자'}</span>님 · “{deadline.eta.label}” · 예정 {deadline.eta.untilText}
                </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-3.5">
                <span className={cn('inline-flex items-center gap-2 text-xs', body)}>
                    {deadline.waiting.count ? (
                        <>
                            <span className="flex items-center -space-x-1">
                                <AvatarStack names={deadline.waiting.names} max={3} size="xs" />
                                {deadline.waiting.hidden > 0 && <HiddenAvatar size="xs" />}
                            </span>
                            {deadline.waiting.count}명이 기다리는 중
                        </>
                    ) : deadline.stage === 'met' ? `${deadline.songCount}곡` : '아직 요청 없음'}
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className={cn('text-xs', sub)}>담당</span>
                    {deadline.leaderName ? (
                        <>
                            <Avatar name={deadline.leaderName} size="sm" />
                            <span className={cn('text-xs font-medium', ink)}>{deadline.leaderName}</span>
                        </>
                    ) : (
                        <span className={cn('text-xs', sub)}>인도자 · 관리자</span>
                    )}
                </span>
            </div>
        </div>
    );
}

function HiddenAvatar({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
    return <span title="이름 숨김" className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', ringCard, chip, sub, size === 'xs' ? 'size-5 text-[9px]' : size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-[11px]')}>?</span>;
}

function NudgeRow({ nudge, label, children }: { nudge: DeadlineNudge; label?: string; children?: ReactNode }) {
    return (
        <li className={cn('flex gap-3.5 border-b py-4 last:border-b-0', line)}>
            {nudge.anonymous && !nudge.mine ? <HiddenAvatar size="md" /> : <Avatar name={nudge.author.replace(' (이름 숨김)', '')} size="md" />}
            <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                    <span className={cn('font-semibold', ink)}>{label ?? nudge.author}</span>
                    <span className={sub}> · {nudge.ago}</span>
                </p>
                <p className={cn('mt-2', bubble)}>{nudge.message}</p>
                {children}
            </div>
        </li>
    );
}

function MemberPanel({ deadline }: { deadline: DeadlineCardView }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const settings = planning.deadlineSettings;
    const [open, setOpen] = useState(false);
    const beforeDeadline = deadline.stage === 'before' || deadline.stage === 'soon';
    const leader = deadline.leaderName ? `${deadline.leaderName}님` : '인도자';

    if (deadline.myNudge) {
        return (
            <ul aria-label="내가 보낸 요청">
                <NudgeRow nudge={deadline.myNudge} label={deadline.myNudge.anonymous ? '요청을 보냈어요 · 이름 숨김' : '요청을 보냈어요'}>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <span className={cn('text-[11px]', sub)}>{deadline.nextNudgeText ? `${deadline.nextNudgeText}부터 다시 요청할 수 있어요` : '다시 요청할 수 있어요'}</span>
                        <button type="button" disabled={busy} onClick={() => void send({ type: 'request.delete', requestId: deadline.myNudge!.id })} className={pill}>
                            <Undo2 size={13} aria-hidden="true" /> 요청 취소
                        </button>
                    </div>
                </NudgeRow>
            </ul>
        );
    }
    if (deadline.eta) return <p className={cn('text-xs', sub)}>예정 시간({deadline.eta.untilText})까지는 요청할 수 없어요.</p>;
    if (beforeDeadline && !settings.nudgeBeforeDeadline) return <p className={cn('text-xs', sub)}>콘티 마감({deadline.deadlineText}) 후에 {leader}께 요청할 수 있어요.</p>;
    if (!open) {
        return (
            <div className="space-y-2">
                {beforeDeadline && <p className={cn('text-xs leading-5', sub)}>아직 마감 전이에요. 급하지 않다면 마감까지 기다려 주세요.</p>}
                <button type="button" onClick={() => setOpen(true)} className={cn(buttonVariants({ variant: deadline.stage === 'overdue' ? 'default' : 'outline' }), 'w-full')}>
                    <Hand size={16} aria-hidden="true" /> {leader}께 콘티 요청
                </button>
            </div>
        );
    }
    return (
        <NudgeComposer
            busy={busy}
            allowAnonymous={settings.allowAnonymous}
            cooldownHours={settings.nudgeCooldownHours}
            onCancel={() => setOpen(false)}
            onSend={async (message, anonymous) => {
                const ok = await send({ type: 'conti.nudge', deadlineKey: deadline.key, title: deadline.setlistTitle ?? deadline.title, serviceAt: deadline.serviceAt, setlistId: deadline.setlistId ?? '', leaderId: deadline.leaderId, message, anonymous });
                if (ok) setOpen(false);
            }}
        />
    );
}

function NudgeComposer({ busy, allowAnonymous, cooldownHours, onSend, onCancel }: { busy: boolean; allowAnonymous: boolean; cooldownHours: number; onSend: (message: string, anonymous: boolean) => void; onCancel: () => void }) {
    const [preset, setPreset] = useState<string>(nudgePresets[0]);
    const [extra, setExtra] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="보낼 말">
                {nudgePresets.map((item) => (
                    <button key={item} type="button" aria-pressed={preset === item} onClick={() => setPreset(item)} className={preset === item ? pillOn : pill}>{item}</button>
                ))}
            </div>
            <label className={cn('flex h-11 items-center gap-2 rounded-full border pl-4 pr-1.5', line)}>
                <span className="sr-only">덧붙일 말</span>
                <input value={extra} onChange={(event) => setExtra(event.target.value)} maxLength={200} placeholder="덧붙일 말 (선택)" className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70', ink)} />
            </label>
            {allowAnonymous && <SwitchRow checked={anonymous} onChange={setAnonymous} icon={EyeOff} label="이름 숨기고 보내기" detail="인도자 · 관리자에게 ‘팀원 1명’으로 보여요" />}
            <div className="flex gap-2">
                <button type="button" onClick={onCancel} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>취소</button>
                <button type="button" disabled={busy} onClick={() => onSend(extra.trim() ? `${preset} ${extra.trim()}` : preset, anonymous)} className={cn(buttonVariants(), 'flex-[2]')}>
                    <Hand size={16} aria-hidden="true" /> 요청 보내기
                </button>
            </div>
            <p className={cn('text-center text-[11px]', sub)}>같은 예배 콘티는 {cooldownHours}시간에 한 번 요청할 수 있어요 · 인도자에게는 묶어서 전달돼요</p>
        </div>
    );
}

/** 인도자가 고르는 예정 시간 (오늘 밤 · 내일 오전 · 3시간 뒤) */
function etaOptions(today: string, now: number) {
    const options = [
        { label: '오늘 밤 안에 올릴게요', until: `${today}T23:59:00+09:00` },
        { label: '내일 오전까지 올릴게요', until: `${addDays(today, 1)}T12:00:00+09:00` },
        { label: '곡 제목부터 먼저 공유할게요', until: new Date(now + 3 * 3600_000).toISOString() },
    ];
    return options.filter((option) => Date.parse(option.until) > now);
}

function LeaderPanel({ deadline, openOrder }: { deadline: DeadlineCardView; openOrder: (setlistId: string) => void }) {
    const { today, editor } = useConti();
    const { send, busy } = useDispatch();
    const [now] = useState(() => Date.now());
    const [moving, setMoving] = useState(false);
    const [moveTo, setMoveTo] = useState('');
    const others = deadline.nudges.filter((nudge) => !nudge.mine);

    return (
        <div className="space-y-5">
            <div className="flex gap-2">
                {deadline.setlistId ? (
                    <button type="button" onClick={() => openOrder(deadline.setlistId!)} className={cn(buttonVariants(), 'flex-1')}>콘티 작성 · 확정하기</button>
                ) : (
                    <Link href={editor?.createHref ?? '/dashboard/songs/library'} className={cn(buttonVariants(), 'flex-1')}>콘티 만들기</Link>
                )}
            </div>
            <p className={cn('-mt-3 text-[11px] leading-5', sub)}>곡 제목만 먼저 정했다면 상태를 ‘초안 공유’로 저장하세요. 팀에 알림이 가고, 마감은 ‘확정’해야 지켜져요.</p>

            <div className="space-y-1">
                <SectionTitle title="기다리는 팀원" meta={others.length ? `${others.length}명` : undefined} />
                <ul>
                    {others.map((nudge) => <NudgeRow key={nudge.id} nudge={nudge} />)}
                    {!others.length && <li className={cn('py-6 text-center text-sm', sub)}>아직 요청이 없어요</li>}
                </ul>
            </div>

            <div className="space-y-3">
                <SectionTitle title="예정 시간 알려주기" />
                <p className={cn('text-xs leading-5', sub)}>요청한 팀원에게 전달되고, 그 시간까지 요청과 마감 알림을 멈춰요.</p>
                <div className="flex flex-wrap gap-1.5">
                    {etaOptions(today, now).map((option) => (
                        <button
                            key={option.label}
                            type="button"
                            disabled={busy}
                            aria-pressed={deadline.eta?.label === option.label}
                            onClick={() => void send({ type: 'conti.eta', deadlineKey: deadline.key, title: deadline.setlistTitle ?? deadline.title, until: option.until, label: option.label })}
                            className={deadline.eta?.label === option.label ? pillOn : pill}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <button type="button" onClick={() => setMoving((value) => !value)} aria-expanded={moving} className={cn('text-xs font-medium underline-offset-2 hover:underline', body)}>
                    이 예배만 마감 바꾸기
                </button>
                {moving && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="datetime-local" value={moveTo} onChange={(event) => setMoveTo(event.target.value)} className={selectBox} aria-label="새 마감 시각" />
                        <button type="button" disabled={busy || !moveTo} onClick={() => void send({ type: 'deadline.override', deadlineKey: deadline.key, at: `${moveTo}:00+09:00` }).then((ok) => ok && setMoving(false))} className={pillOn}>저장</button>
                        {deadline.overridden && <button type="button" disabled={busy} onClick={() => void send({ type: 'deadline.override', deadlineKey: deadline.key, at: null })} className={pill}>팀 기본으로</button>}
                    </div>
                )}
            </div>
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

const RULE_PRESETS: { label: string; rule: DeadlineSettings['rule'] }[] = [
    { label: '예배 전 화요일 23:59', rule: { kind: 'weekday', weekday: 2, time: '23:59' } },
    { label: '예배 3일 전 22:00', rule: { kind: 'daysBefore', days: 3, time: '22:00' } },
    { label: '예배 2일 전 21:00', rule: { kind: 'daysBefore', days: 2, time: '21:00' } },
];
const sameRule = (a: DeadlineSettings['rule'], b: DeadlineSettings['rule']) => JSON.stringify(a) === JSON.stringify(b);

function DeadlineSettingsPanel({ onDone }: { onDone: () => void }) {
    const { planning } = useConti();
    const { send, busy } = useDispatch();
    const [draft, setDraft] = useState<DeadlineSettings>(planning.deadlineSettings ?? DEFAULT_DEADLINE_SETTINGS);
    const set = <K extends keyof DeadlineSettings>(key: K, value: DeadlineSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
    const custom = !RULE_PRESETS.some((preset) => sameRule(preset.rule, draft.rule));
    const rule = draft.rule;

    return (
        <div className={cn('space-y-6 rounded-3xl border p-5', line)}>
            <SwitchRow checked={draft.enabled} onChange={(value) => set('enabled', value)} icon={AlarmClock} label="콘티 마감 알림 쓰기" detail="끄면 예약 알림과 팀원 요청 버튼이 모두 멈춰요" />
            <div className="space-y-2.5">
                <p className={cn('text-sm font-semibold', ink)}>콘티 마감</p>
                <div className="flex flex-wrap gap-1.5">
                    {RULE_PRESETS.map((preset) => (
                        <button key={preset.label} type="button" aria-pressed={sameRule(preset.rule, rule)} onClick={() => set('rule', preset.rule)} className={sameRule(preset.rule, rule) ? pillOn : pill}>{preset.label}</button>
                    ))}
                    <button type="button" aria-pressed={custom} onClick={() => set('rule', { kind: 'weekday', weekday: 3, time: '22:00' })} className={custom ? pillOn : pill}>직접 정하기</button>
                </div>
                {custom && (
                    <div className={cn('flex flex-wrap items-center gap-2 text-xs', body)}>
                        <select className={selectBox} value={rule.kind === 'weekday' ? `w${rule.weekday}` : `d${rule.days}`} onChange={(event) => {
                            const value = event.target.value;
                            set('rule', value.startsWith('w') ? { kind: 'weekday', weekday: Number(value.slice(1)), time: rule.time } : { kind: 'daysBefore', days: Number(value.slice(1)), time: rule.time });
                        }}>
                            {[1, 2, 3, 4, 5, 6].map((day) => <option key={`w${day}`} value={`w${day}`}>예배 전 {WEEKDAY_LABEL[day]}요일</option>)}
                            {[1, 2, 3, 4, 5, 6, 7].map((days) => <option key={`d${days}`} value={`d${days}`}>예배 {days}일 전</option>)}
                        </select>
                        <input type="time" className={selectBox} value={rule.time} onChange={(event) => event.target.value && set('rule', { ...rule, time: event.target.value })} />
                        까지
                    </div>
                )}
            </div>
            <div className="space-y-2.5">
                <p className={cn('text-sm font-semibold', ink)}>마감 전 인도자 알림</p>
                <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(REMINDER_LABEL) as ReminderKey[]).map((key) => {
                        const on = draft.reminders.includes(key);
                        return <button key={key} type="button" aria-pressed={on} onClick={() => set('reminders', on ? draft.reminders.filter((item) => item !== key) : [...draft.reminders, key])} className={on ? pillOn : pill}>{REMINDER_LABEL[key]}</button>;
                    })}
                </div>
            </div>
            <div className="space-y-4">
                <p className={cn('text-sm font-semibold', ink)}>마감이 지나면</p>
                <SwitchRow checked={draft.notifyTeam} onChange={(value) => set('notifyTeam', value)} label="배치된 팀원에게도 알림" detail="인도자에게는 항상 가요" />
                <div className="flex items-center justify-between gap-3">
                    <p className={cn('text-sm font-medium', ink)}>관리자에게 알림</p>
                    <select className={selectBox} value={draft.escalateHours} onChange={(event) => set('escalateHours', Number(event.target.value))}>
                        <option value={0}>보내지 않음</option>
                        {[6, 12, 24].map((hour) => <option key={hour} value={hour}>마감 {hour}시간 뒤</option>)}
                    </select>
                </div>
            </div>
            <div className="space-y-4">
                <p className={cn('text-sm font-semibold', ink)}>팀원 요청</p>
                <SwitchRow checked={draft.nudgeBeforeDeadline} onChange={(value) => set('nudgeBeforeDeadline', value)} label="마감 전에도 요청 허용" />
                <SwitchRow checked={draft.allowAnonymous} onChange={(value) => set('allowAnonymous', value)} label="이름 숨김 요청 허용" />
                <div className="flex items-center justify-between gap-3">
                    <p className={cn('text-sm font-medium', ink)}>같은 팀원 재요청 간격</p>
                    <select className={selectBox} value={draft.nudgeCooldownHours} onChange={(event) => set('nudgeCooldownHours', Number(event.target.value))}>
                        {[1, 3, 6].map((hour) => <option key={hour} value={hour}>{hour}시간</option>)}
                    </select>
                </div>
                <SwitchRow checked={draft.quietHours} onChange={(value) => set('quietHours', value)} label="밤 23:00–07:00 알림은 아침에" />
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={onDone} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>닫기</button>
                <button type="button" disabled={busy} onClick={() => void send({ type: 'deadline.settings', settings: draft }).then((ok) => ok && onDone())} className={cn(buttonVariants(), 'flex-[2]')}>저장</button>
            </div>
        </div>
    );
}
