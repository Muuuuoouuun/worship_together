'use client';

import { useId, useMemo, useState } from 'react';
import { BellRing, Check, ChevronDown, Megaphone, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { can } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Select, Textarea, fieldClass } from '@/components/ui/input';
import { Avatar, TONE_BLOCK, attentionText } from '@/components/conti/ui';
import { pill, pillOn } from '@/components/conti/planningUi';
import { useTeamPolicy } from '@/components/app/TeamConnection';
import { planningDate, type AnnouncementAudience, type PlanningPanelProps, type TeamAnnouncement, type TeamSchedule } from '@/types/planning';
import { isPlaceholderMember, worshipRoles, type TeamMember, type WorshipRole } from '@/types/team';

/*
 * 팀 공지. 일정과 별개로 팀 전체 · 몇 개 파트 · 한 일정에 배치된 사람에게 올리고,
 * '확인 받기' 를 켜면 받은 사람이 '확인했어요' 를 누르고 쓴 사람은 누가 아직인지 보고 다시 알립니다.
 */

type AudienceKind = AnnouncementAudience['kind'];
const fieldLabel = 'block text-xs font-medium text-muted-foreground';
const summaryRow = 'cursor-pointer list-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden';

/** 공지 대상 한 줄 (일정이 지워졌으면 '지난 일정') */
export function audienceLabel(audience: AnnouncementAudience, events: TeamSchedule[]): string {
    if (audience.kind === 'all') return '팀 전체';
    if (audience.kind === 'roles') return audience.roles.map((role) => worshipRoles[role]).join(' · ');
    const event = events.find((item) => item.id === audience.eventId);
    return event ? `${event.title} 배치 인원` : '지난 일정 배치 인원';
}

/** 아직 확인하지 않은 받는 사람 (팀을 떠난 사람은 빼고) — lib/planning 의 규칙과 같음 */
export function pendingRecipients(item: TeamAnnouncement, members: TeamMember[]): string[] {
    return item.recipientIds.filter((id) => members.some((member) => member.userId === id) && !item.acks.some((ack) => ack.userId === id));
}

export default function AnnouncementsPanel({ state, members, userId, busy, onCommand }: PlanningPanelProps) {
    const policy = useTeamPolicy();
    const me = members.find((member) => member.userId === userId);
    const canAnnounce = can(me, policy, 'announce');
    const names = useMemo(() => new Map(members.map((member) => [member.userId, member.name])), [members]);
    const announcements = state.announcements ?? [];
    const open = announcements.filter((item) => !item.closedAt);
    const closed = announcements.filter((item) => item.closedAt);
    const [composing, setComposing] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold tracking-tight text-foreground">팀 공지</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        연습 시간 변경 · 준비물 · 새 곡처럼 모두가 알아야 할 소식이에요. 확인을 받는 공지는 누가 확인했는지 함께 보여요.
                    </p>
                </div>
                {canAnnounce && !composing && (
                    <Button type="button" variant="brand" size="sm" onClick={() => setComposing(true)}>
                        <Megaphone aria-hidden="true" />
                        새 공지
                    </Button>
                )}
            </div>
            {canAnnounce && composing && (
                <section className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5">
                    <Composer
                        members={members}
                        events={state.events}
                        disabled={busy}
                        onCancel={() => setComposing(false)}
                        onSubmit={async (command) => {
                            const ok = await onCommand({ type: 'announcement.create', ...command });
                            if (ok) setComposing(false);
                            return ok;
                        }}
                    />
                </section>
            )}
            {open.length ? (
                <ul className="space-y-3">
                    {open.map((item) => (
                        <li key={item.id}>
                            <AnnouncementCard item={item} members={members} names={names} events={state.events} userId={userId} manager={canAnnounce} owner={me?.permission === 'owner'} disabled={busy} onCommand={onCommand} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="rounded-3xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
                    {canAnnounce ? '아직 올린 공지가 없어요. ‘새 공지’로 팀에 알려 보세요.' : '지금 확인할 공지가 없어요.'}
                </p>
            )}
            {closed.length > 0 && (
                <details className="group border-t border-border/70 pt-3">
                    <summary className={cn(summaryRow, 'flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground')}>
                        마감한 공지 <span className="tabular-nums">{closed.length}</span>
                        <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-3">
                        {closed.map((item) => (
                            <li key={item.id}>
                                <AnnouncementCard item={item} members={members} names={names} events={state.events} userId={userId} manager={canAnnounce} owner={me?.permission === 'owner'} disabled={busy} onCommand={onCommand} />
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

function Composer({ members, events, disabled, onCancel, onSubmit }: {
    members: TeamMember[];
    events: TeamSchedule[];
    disabled: boolean;
    onCancel: () => void;
    onSubmit: (command: { title: string; body: string; audience: AnnouncementAudience; requireAck: boolean }) => Promise<boolean>;
}) {
    const id = useId();
    const [kind, setKind] = useState<AudienceKind>('all');
    const [roles, setRoles] = useState<WorshipRole[]>([]);
    // 팀에 실제로 있는 파트만 고를 수 있게 합니다.
    const teamRoles = useMemo(() => (Object.keys(worshipRoles) as WorshipRole[]).filter((role) => members.some((member) => member.role === role && !isPlaceholderMember(member.userId))), [members]);
    // 쓰기 시작한 시각 기준으로 아직 끝나지 않은 일정만 고릅니다.
    const [openedAt] = useState(() => Date.now());
    const upcoming = useMemo(() => events.filter((event) => !event.cancelled && Date.parse(event.endsAt) >= openedAt).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 20), [events, openedAt]);
    const [eventId, setEventId] = useState(upcoming[0]?.id ?? '');
    const kinds: { value: AudienceKind; label: string; disabled?: boolean }[] = [
        { value: 'all', label: '팀 전체' },
        { value: 'roles', label: '파트 고르기' },
        { value: 'event', label: '일정 배치 인원', disabled: !upcoming.length },
    ];

    return (
        <form
            className="text-foreground"
            onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const title = String(data.get('title') ?? '').trim();
                const body = String(data.get('body') ?? '').trim();
                if (!title || !body) return;
                const audience: AnnouncementAudience = kind === 'roles' ? { kind, roles } : kind === 'event' ? { kind, eventId } : { kind: 'all' };
                if (audience.kind === 'roles' && !roles.length) return;
                if (audience.kind === 'event' && !eventId) return;
                const ok = await onSubmit({ title, body, audience, requireAck: data.get('requireAck') === 'on' });
                if (ok) form.reset();
            }}
        >
            <h3 id={`${id}-heading`} className="text-[15px] font-semibold tracking-tight">새 공지</h3>
            <fieldset disabled={disabled} aria-labelledby={`${id}-heading`} className="mt-4 min-w-0 space-y-4">
                <label className="block space-y-1.5">
                    <span className={fieldLabel}>제목 <span className="font-normal opacity-70">(필수)</span></span>
                    <input name="title" className={fieldClass} required maxLength={80} pattern=".*\S.*" placeholder="예: 이번 주 연습은 7시 30분에 시작해요" />
                </label>
                <label className="block space-y-1.5">
                    <span className={fieldLabel}>내용 <span className="font-normal opacity-70">(필수)</span></span>
                    <Textarea name="body" className="min-h-28 resize-y" rows={4} required maxLength={1500} placeholder="모두가 알아야 할 내용을 적어 주세요." />
                </label>
                <div className="space-y-2">
                    <span className={fieldLabel}>받는 사람</span>
                    <div role="radiogroup" aria-label="받는 사람" className="flex flex-wrap gap-1.5">
                        {kinds.map((item) => (
                            <button key={item.value} type="button" role="radio" aria-checked={kind === item.value} disabled={item.disabled} className={kind === item.value ? pillOn : pill} onClick={() => setKind(item.value)}>
                                {kind === item.value && <Check size={13} aria-hidden="true" />}
                                {item.label}
                            </button>
                        ))}
                    </div>
                    {kind === 'roles' && (
                        <div role="group" aria-label="공지를 받을 파트" className="flex flex-wrap gap-1.5 pt-1">
                            {teamRoles.map((role) => {
                                const on = roles.includes(role);
                                return (
                                    <button key={role} type="button" aria-pressed={on} className={on ? pillOn : pill} onClick={() => setRoles((current) => (on ? current.filter((item) => item !== role) : [...current, role]))}>
                                        {on && <Check size={13} aria-hidden="true" />}
                                        {worshipRoles[role]}
                                    </button>
                                );
                            })}
                            {!roles.length && <p className="w-full text-xs text-muted-foreground">받을 파트를 하나 이상 골라 주세요.</p>}
                        </div>
                    )}
                    {kind === 'event' && (
                        <Select aria-label="공지를 받을 일정" value={eventId} onChange={(event) => setEventId(event.target.value)}>
                            {upcoming.map((event) => <option key={event.id} value={event.id}>{planningDate(event.startsAt)} · {event.title}</option>)}
                        </Select>
                    )}
                </div>
                <label className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" name="requireAck" defaultChecked className="mt-0.5 size-4 shrink-0 accent-primary" />
                    <span>
                        <span className="font-medium">확인 받기</span>
                        <span className="block text-xs leading-5 text-muted-foreground">받은 사람이 ‘확인했어요’를 누르면 누가 확인했는지 보이고, 아직인 사람에게 다시 알릴 수 있어요.</span>
                    </span>
                </label>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="brand">
                        <Send size={15} aria-hidden="true" />
                        {disabled ? '올리는 중…' : '공지 올리기'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>
                </div>
            </fieldset>
        </form>
    );
}

function AnnouncementCard({ item, members, names, events, userId, manager, owner, disabled, onCommand }: {
    item: TeamAnnouncement;
    members: TeamMember[];
    names: Map<string, string>;
    events: TeamSchedule[];
    userId: string;
    manager: boolean;
    owner: boolean;
    disabled: boolean;
    onCommand: PlanningPanelProps['onCommand'];
}) {
    const mine = item.authorId === userId;
    const recipient = item.recipientIds.includes(userId);
    const myAck = item.acks.find((ack) => ack.userId === userId);
    const pending = pendingRecipients(item, members);
    const total = pending.length + item.acks.length;
    const canFollowUp = (mine || manager) && !item.closedAt;
    const name = (memberId: string) => names.get(memberId) ?? '이전 팀원';
    const waitingMe = recipient && !myAck && !item.closedAt;

    return (
        <article className={cn('rounded-3xl border p-4 sm:p-5', waitingMe ? cn('border-transparent', TONE_BLOCK.peach) : 'border-border/70 bg-card', item.closedAt && 'opacity-80')}>
            <div className="flex items-start gap-3">
                <Avatar name={name(item.authorId)} size="md" />
                <div className="min-w-0 flex-1">
                    <h3 className="break-words text-[15px] font-semibold leading-snug tracking-tight text-foreground">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {name(item.authorId)} · <time dateTime={item.createdAt}>{planningDate(item.createdAt)}</time> · {audienceLabel(item.audience, events)}
                        {item.closedAt ? ' · 마감' : ''}
                    </p>
                </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">{item.body}</p>

            {item.requireAck && (
                <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">확인 <span className="tabular-nums">{item.acks.length}/{total}</span></span>
                        {pending.length > 0 && <span className={cn('font-medium', attentionText)}>아직 {pending.length}명</span>}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${total}명 중 ${item.acks.length}명 확인`}>
                        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: total ? `${(item.acks.length / total) * 100}%` : '0%' }} />
                    </div>
                    <details className="group mt-2">
                        <summary className={cn(summaryRow, 'inline-flex items-center gap-1 text-xs text-muted-foreground')}>
                            누가 확인했는지 보기
                            <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                            <p className="leading-5"><span className="font-medium text-foreground">확인함</span> <span className="text-muted-foreground">{item.acks.length ? item.acks.map((ack) => name(ack.userId)).join(', ') : '아직 없음'}</span></p>
                            <p className="leading-5"><span className="font-medium text-foreground">아직</span> <span className="text-muted-foreground">{pending.length ? pending.map(name).join(', ') : '모두 확인했어요'}</span></p>
                        </div>
                    </details>
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {waitingMe && (
                    <Button type="button" size="sm" disabled={disabled} onClick={() => void onCommand({ type: 'announcement.ack', announcementId: item.id })}>
                        <Check aria-hidden="true" />
                        확인했어요
                    </Button>
                )}
                {recipient && myAck && <span className="inline-flex items-center gap-1 text-xs font-medium text-brand"><Check size={13} aria-hidden="true" />확인함 · {planningDate(myAck.at)}</span>}
                {canFollowUp && item.requireAck && pending.length > 0 && (
                    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void onCommand({ type: 'announcement.remind', announcementId: item.id })}>
                        <BellRing aria-hidden="true" />
                        아직 {pending.length}명에게 다시 알림
                    </Button>
                )}
                {canFollowUp && (
                    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => void onCommand({ type: 'announcement.close', announcementId: item.id })}>
                        마감
                    </Button>
                )}
                {(mine || owner) && (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="공지 삭제" title="공지 삭제" className="ml-auto text-muted-foreground" disabled={disabled} onClick={() => { if (window.confirm('이 공지를 삭제할까요? 팀원의 알림에서도 사라져요.')) void onCommand({ type: 'announcement.delete', announcementId: item.id }); }}>
                        <Trash2 size={15} aria-hidden="true" />
                    </Button>
                )}
            </div>
            {item.remindedAt && !item.closedAt && <p className="mt-2 text-[11px] text-muted-foreground">마지막으로 다시 알림 · {planningDate(item.remindedAt)}</p>}
        </article>
    );
}
