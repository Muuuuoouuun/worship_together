'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Gauge, Lock, Maximize, Minus, Plus, SunMedium, type LucideIcon, Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBeatEffects } from './beatEffects';
import { buttonVariants } from '@/components/ui/button';
import { Avatar, TONE_BLOCK } from '@/components/conti/ui';
import { worshipRoles } from '@/types/team';
import { controllerText, keyText, sortMembers, type LivePosition } from './derive';
import type { DeviceToggles } from './hooks';
import { CUE_TARGET_LABEL, type LiveCueEntry, type LiveMember, type LiveScreenHandlers, type LiveScreenModel } from './model';
import { isFresh, relativeTime, useNow } from './time';

/*
 * 시트 · 팝오버 안의 내용 — 순서(모바일 순서 시트)와 더보기(내 역할 · 이 기기 · 진행 · 팀 접속 · 최근 큐).
 * 모바일은 아래 시트, 데스크톱은 위 오른쪽 팝오버가 같은 더보기 내용을 씁니다.
 */

/* ───────────── 순서 ───────────── */

/** @param onPick 진행할 수 있을 때만. 없으면 보기만 하는 목록 */
export function OrderList({ model, pos, onPick }: { model: LiveScreenModel; pos: LivePosition; onPick?: (index: number) => void }) {
    const who = controllerText(model.controllerNames);
    return (
        <div>
            {onPick ? null : (
                <p className="mb-2 rounded-2xl bg-muted px-4 py-3 text-[13px] leading-snug text-muted-foreground">
                    {who ? `${who}이 순서를 넘겨요` : '진행하는 분이 순서를 넘겨요'} · 여기서는 보기만 할 수 있어요
                </p>
            )}
            <ol className="divide-y divide-border">
                {model.songs.map((song, index) => {
                    const current = index === pos.songIndex;
                    const done = index < pos.songIndex;
                    const body = (
                        <>
                            <span className={cn('w-6 shrink-0 text-sm tabular-nums', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{String(index + 1).padStart(2, '0')}</span>
                            <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-[17px] font-semibold tracking-tight', done && 'text-muted-foreground')}>{song.title}</span>
                                <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                                    {song.bpm ?? '—'} BPM · {song.meter} · {song.sections.length > 0 ? `${song.sections.length}섹션` : '송폼 없음'}
                                    {song.lead ? ` · 리드 ${song.lead}` : ''}
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className="inline-flex h-7 items-center rounded-full bg-muted px-2.5 text-[13px] font-semibold">Key {keyText(song.key)}</span>
                                {current ? <span className="text-xs font-medium text-brand">지금</span> : done ? <span className="text-xs text-muted-foreground">마침</span> : null}
                            </span>
                        </>
                    );
                    return (
                        <li key={`${song.id}-${index}`} className="py-1.5">
                            {onPick ? (
                                <button
                                    type="button"
                                    aria-current={current ? 'true' : undefined}
                                    onClick={() => onPick(index)}
                                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring"
                                >
                                    {body}
                                </button>
                            ) : (
                                <div aria-current={current ? 'true' : undefined} className="flex items-center gap-3.5 py-2.5">
                                    {body}
                                </div>
                            )}
                            {song.note ? (
                                <p className={cn('mb-1.5 ml-[2.375rem] mt-0.5 rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug [overflow-wrap:anywhere]', TONE_BLOCK.peach)}>
                                    <span className="mr-1.5 font-semibold text-secondary">특이사항</span>
                                    {song.note}
                                </p>
                            ) : null}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

/* ───────────── 더보기 ───────────── */

export function MoreBody({
    model,
    handlers,
    device,
    onLock,
}: {
    model: LiveScreenModel;
    handlers: LiveScreenHandlers;
    device: DeviceToggles;
    onLock: () => void;
}) {
    const online = model.members.filter((member) => member.online).length;
    const who = controllerText(model.controllerNames);
    const [effects, setEffect] = useBeatEffects();
    return (
        <div className="space-y-7">
            <section aria-label="내 역할">
                <h3 className="text-xs font-medium text-muted-foreground">내 역할</h3>
                <div className="mt-2 flex items-center gap-3">
                    <Avatar name={model.me.name} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold tracking-tight">
                            {model.me.name} <span className="font-medium text-muted-foreground">· {worshipRoles[model.me.role]}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {CUE_TARGET_LABEL[model.me.group]} 큐와 전체 큐를 받아요 · {model.canControl ? '곡 · 섹션을 넘길 수 있어요' : who ? `${who}을 따라가요` : '진행하는 분을 따라가요'}
                        </p>
                    </div>
                </div>
            </section>

            <section aria-label="이 기기">
                <h3 className="text-xs font-medium text-muted-foreground">이 기기</h3>
                <ul className="mt-1 divide-y divide-border">
                    {device.wakeSupported ? <ToggleRow icon={SunMedium} label="화면 꺼짐 방지" hint="예배 중 화면이 꺼지지 않아요" on={device.awake} onToggle={device.toggleAwake} /> : null}
                    {device.fullscreenSupported ? <ToggleRow icon={Maximize} label="전체화면" hint="주소창과 상태 막대를 숨겨요" on={device.fullscreen} onToggle={device.toggleFullscreen} /> : null}
                    <ToggleRow icon={Activity} label="펄스 효과" hint="박마다 숫자가 살짝 커지고 첫 박에 링이 퍼져요" on={effects.pulse} onToggle={() => setEffect('pulse', !effects.pulse)} />
                    <ToggleRow icon={Zap} label="깜빡임" hint="박마다 빛나요 · 지금 · 악보 화면의 BPM 옆 점도" on={effects.blink} onToggle={() => setEffect('blink', !effects.blink)} />
                    <li className="flex items-center gap-3 py-3">
                        <RowIcon icon={Lock} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold tracking-tight">화면 잠금</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">연주 중 잘못 눌리지 않게 잠가요 · 큐 확인은 돼요</p>
                        </div>
                        <button type="button" onClick={onLock} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-11 px-4')}>
                            잠그기
                        </button>
                    </li>
                </ul>
            </section>

            {model.canControl && model.bpm !== null ? (
                <section aria-label="진행">
                    <h3 className="text-xs font-medium text-muted-foreground">진행</h3>
                    <TempoStepper bpm={model.bpm} onChange={handlers.setBpm} />
                </section>
            ) : null}

            <section aria-label="팀 접속">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground">팀 접속</h3>
                    <p className="text-xs tabular-nums text-muted-foreground">
                        {model.members.length}명 중 {online}명
                    </p>
                </div>
                <MemberList members={model.members} />
            </section>

            <section aria-label="최근 큐">
                <h3 className="text-xs font-medium text-muted-foreground">최근 큐</h3>
                <RecentCueList cues={model.cues} myName={model.me.name} />
            </section>

            <div className="space-y-2.5 border-t border-border pt-5">
                <Link href={model.contiHref} className={cn(buttonVariants({ variant: 'outline' }), 'h-12 w-full')}>
                    <FileText className="size-[18px]" aria-hidden="true" />
                    콘티 보기
                </Link>
                {model.canControl ? <EndService onEnd={handlers.end} /> : null}
            </div>
        </div>
    );
}

function TempoStepper({ bpm, onChange }: { bpm: number; onChange: (bpm: number) => void }) {
    const set = (value: number) => onChange(Math.max(30, Math.min(280, Math.round(value))));
    return (
        <div className="mt-1 flex items-center gap-3 py-3">
            <RowIcon icon={Gauge} />
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-tight">템포</p>
                <p className="mt-0.5 text-xs text-muted-foreground">바꾸면 모두의 박이 함께 바뀌어요</p>
            </div>
            <div role="group" aria-label="템포" className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => set(bpm - 1)} aria-label="BPM 1 내리기" className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'text-foreground')}>
                    <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-12 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
                    {bpm}
                    <span className="sr-only"> BPM</span>
                </span>
                <button type="button" onClick={() => set(bpm + 1)} aria-label="BPM 1 올리기" className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'text-foreground')}>
                    <Plus className="size-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

/** 예배 마치기 — 한 번 더 묻고 마칩니다 (모든 팀원 화면이 함께 끝나므로) */
function EndService({ onEnd }: { onEnd: () => void }) {
    const [confirming, setConfirming] = useState(false);
    const cancelRef = useRef<HTMLButtonElement | null>(null);
    const titleId = useId();

    useEffect(() => {
        if (confirming) cancelRef.current?.focus({ preventScroll: true });
    }, [confirming]);

    if (!confirming) {
        return (
            <button type="button" onClick={() => setConfirming(true)} className={cn(buttonVariants({ variant: 'destructive-outline' }), 'h-12 w-full')}>
                예배 마치기
            </button>
        );
    }
    return (
        <div role="group" aria-labelledby={titleId} className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/30">
            <p id={titleId} className="text-[15px] font-semibold tracking-tight">
                예배를 마칠까요?
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">모든 팀원 화면이 함께 &lsquo;예배를 마쳤어요&rsquo; 로 바뀌어요. 마친 뒤에는 다시 진행할 수 없어요.</p>
            <div className="mt-3 flex gap-2">
                <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} className={cn(buttonVariants({ variant: 'outline' }), 'h-11 flex-1')}>
                    계속 진행
                </button>
                <button type="button" onClick={onEnd} className={cn(buttonVariants({ variant: 'destructive' }), 'h-11 flex-1')}>
                    마치기
                </button>
            </div>
        </div>
    );
}

export function MemberList({ members, compact = false }: { members: LiveMember[]; compact?: boolean }) {
    if (members.length === 0) return <p className="mt-2 text-sm text-muted-foreground">아직 팀원 정보가 없어요</p>;
    return (
        <ul className="mt-1 divide-y divide-border">
            {sortMembers(members).map((member) => (
                <li key={member.userId} className={cn('flex items-center gap-3', compact ? 'py-2.5' : 'py-3')}>
                    <span className={cn('shrink-0', !member.online && 'opacity-50')}>
                        <Avatar name={member.name} size={compact ? 'sm' : 'md'} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className={cn('flex min-w-0 items-center gap-1.5 font-semibold tracking-tight', compact ? 'text-sm' : 'text-[15px]', !member.online && 'text-muted-foreground')}>
                            <span className="truncate">{member.name}</span>
                            {member.me ? <span className="shrink-0 text-xs font-medium text-muted-foreground">나</span> : null}
                            {member.controller ? <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">진행</span> : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.roleLabel}</p>
                    </div>
                    {member.online ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                            접속
                        </span>
                    ) : (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/40" />
                            오프라인
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** 최근 큐 (보내기는 엄지 자리의 빠른 큐가 맡고, 여기는 보기만) — 확인 현황은 받은 사람 수 기준 */
export function RecentCueList({ cues, myName }: { cues: LiveCueEntry[]; myName: string }) {
    const now = useNow(30_000);
    if (cues.length === 0) return <p className="mt-2 text-sm text-muted-foreground">아직 주고받은 큐가 없어요</p>;
    return (
        <ul className="mt-1 divide-y divide-border">
            {cues.map((cue) => (
                <li key={cue.id} className="flex items-center gap-3 py-3">
                    <Avatar name={cue.fromMe ? myName : cue.fromName} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[15px] font-semibold tracking-tight">{cue.label}</span>
                            {cue.forMe && !cue.ackedByMe ? <span role="img" aria-label="아직 확인 안 함" className="size-1.5 shrink-0 rounded-full bg-secondary" /> : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {cue.fromMe ? '내가 보냄' : cue.fromName} → {cue.targetLabel}
                            {cue.recipients > 0 ? (
                                <span className="tabular-nums">
                                    {' '}
                                    · 확인 {cue.acks.length}/{cue.recipients}
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <span className={cn('shrink-0 text-xs', isFresh(cue.createdAt, now) && !cue.fromMe ? 'font-medium text-secondary' : 'text-muted-foreground')}>{relativeTime(cue.createdAt, now)}</span>
                </li>
            ))}
        </ul>
    );
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
            <Icon className="size-[18px]" aria-hidden="true" />
        </span>
    );
}

function ToggleRow({ icon, label, hint, on, onToggle }: { icon: LucideIcon; label: string; hint: string; on: boolean; onToggle: () => void }) {
    const labelId = useId();
    return (
        <li className="flex items-center gap-3 py-3">
            <RowIcon icon={icon} />
            <div className="min-w-0 flex-1">
                <p id={labelId} className="text-[15px] font-semibold tracking-tight">
                    {label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                onClick={onToggle}
                className="flex h-11 shrink-0 items-center rounded-full px-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
                <span className={cn('flex h-7 w-12 items-center rounded-full p-0.5 transition-colors', on ? 'bg-primary' : 'bg-input')}>
                    <span className={cn('size-6 rounded-full bg-card shadow-sm transition-transform motion-reduce:transition-none', on && 'translate-x-5')} />
                </span>
            </button>
        </li>
    );
}
