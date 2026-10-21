'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, KeyRound, Plus, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import Notice from '@/components/ui/Notice';
import AcceptInvitation from '@/components/team/AcceptInvitation';
import { completeOnboarding, createOnlineTeam, previewInvitation, updateProfileName } from '@/actions/teamActions';
import type { InvitationPreview } from '@/types/team';

type Step = 'name' | 'team';
type TeamMode = 'choose' | 'create' | 'join';

const INPUT = 'h-12 w-full rounded-2xl border border-border bg-background px-4 text-base text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring';

/**
 * 시작하기 — 휴대폰 한 손 기준. 한 화면에 한 가지만 묻습니다.
 * 1) 팀에서 보일 이름  2) 새 팀 만들기 / 초대 코드로 참여 (나중에 하기 가능)
 */
export default function Onboarding({ name: initialName, hasTeams, startAtTeam, initialCode }: { name: string; hasTeams: boolean; startAtTeam: boolean; initialCode: string }) {
    const router = useRouter();
    const [step, setStep] = useState<Step>(startAtTeam ? 'team' : 'name');
    const [mode, setMode] = useState<TeamMode>(initialCode ? 'join' : 'choose');
    const [name, setName] = useState(initialName);
    const [teamName, setTeamName] = useState('');
    const [code, setCode] = useState(initialCode);
    const [invite, setInvite] = useState<InvitationPreview | null>(null);
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();

    const run = (task: () => Promise<void>) => {
        setError('');
        startTransition(async () => {
            try { await task(); } catch { setError('연결을 확인한 뒤 다시 시도해주세요.'); }
        });
    };

    const saveName = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            if (name.trim() !== initialName) {
                const result = await updateProfileName(name);
                if (!result.ok) { setError(result.error); return; }
            }
            setStep('team');
        });
    };

    const createTeam = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            const result = await createOnlineTeam(teamName);
            if (!result.ok) { setError(result.error); return; }
            router.replace('/dashboard/team?created=1');
            router.refresh();
        });
    };

    const findInvite = (event: FormEvent) => {
        event.preventDefault();
        run(async () => {
            const result = await previewInvitation(code);
            if (!result.ok) { setError(result.error); return; }
            setInvite(result.value);
        });
    };

    const later = () => run(async () => {
        await completeOnboarding();
        router.replace('/dashboard');
        router.refresh();
    });

    return (
        <main className="flex min-h-dvh flex-col bg-background px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)] sm:items-center sm:justify-center sm:py-10">
            <section className="flex w-full max-w-[440px] flex-1 flex-col sm:flex-none sm:rounded-[28px] sm:border sm:border-border sm:bg-card sm:p-9">
                <div className="flex h-11 items-center justify-between">
                    {step === 'team' && (mode !== 'choose' || !hasTeams) ? (
                        <button
                            type="button"
                            onClick={() => { setError(''); setInvite(null); if (mode !== 'choose') setMode('choose'); else setStep('name'); }}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), '-ml-3')}
                            aria-label="이전 단계"
                        >
                            <ArrowLeft className="size-5" aria-hidden="true" />
                        </button>
                    ) : <span className="text-xs font-medium text-muted-foreground">Worship Together</span>}
                    {hasTeams ? <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">닫기</Link> : <StepDots step={step} />}
                </div>

                {step === 'name' ? (
                    <form onSubmit={saveName} className="flex flex-1 flex-col">
                        <Heading eyebrow="1 / 2 · 내 이름" title="팀에서 어떤 이름으로 보일까요?" description="콘티 코멘트 · 일정 · 예배 중 큐에 이 이름이 보여요. 나중에 팀 화면에서 바꿀 수 있어요." />
                        <label htmlFor="onboarding-name" className="sr-only">이름</label>
                        <input id="onboarding-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="name" className={INPUT} placeholder="예: 김찬양" />
                        <ErrorLine error={error} />
                        <div className="mt-auto pt-8 sm:mt-8 sm:pt-0">
                            <Button type="submit" size="lg" className="w-full" disabled={pending || !name.trim()}>
                                다음
                                <ArrowRight aria-hidden="true" />
                            </Button>
                        </div>
                    </form>
                ) : mode === 'choose' ? (
                    <div className="flex flex-1 flex-col">
                        <Heading eyebrow={hasTeams ? '팀 추가' : '2 / 2 · 팀'} title="함께할 예배팀을 정해요" description="팀을 만들면 초대 링크 · 코드로 팀원을 부를 수 있어요. 초대를 받았다면 코드를 입력하세요." />
                        <div className="grid gap-3">
                            <Choice icon={<KeyRound className="size-5" aria-hidden="true" />} title="초대 코드로 참여" body="팀 관리자에게 받은 8자리 코드나 초대 링크" onClick={() => { setError(''); setMode('join'); }} />
                            <Choice icon={<Plus className="size-5" aria-hidden="true" />} title="새 팀 만들기" body="내가 관리자가 되어 팀원을 초대해요" onClick={() => { setError(''); setMode('create'); }} />
                        </div>
                        <ErrorLine error={error} />
                        {!hasTeams ? (
                            <div className="mt-auto pt-8 text-center sm:mt-8 sm:pt-0">
                                <button type="button" onClick={later} disabled={pending} className="min-h-11 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                                    나중에 할게요 · 예시로 둘러보기
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : mode === 'create' ? (
                    <form onSubmit={createTeam} className="flex flex-1 flex-col">
                        <Heading eyebrow="새 팀" title="팀 이름을 정해요" description="교회 · 예배 이름처럼 팀원이 알아보기 쉬운 이름이 좋아요." />
                        <label htmlFor="onboarding-team" className="sr-only">팀 이름</label>
                        <input id="onboarding-team" value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={40} className={INPUT} placeholder="예: 주일 2부 예배팀" autoFocus />
                        <ErrorLine error={error} />
                        <div className="mt-auto pt-8 sm:mt-8 sm:pt-0">
                            <Button type="submit" size="lg" variant="brand" className="w-full" disabled={pending || !teamName.trim()}>
                                {pending ? '만드는 중…' : '팀 만들기'}
                            </Button>
                        </div>
                    </form>
                ) : invite ? (
                    <div className="flex flex-1 flex-col">
                        <Heading eyebrow="초대받은 팀" title={invite.teamName} description={`${new Date(invite.expiresAt).toLocaleDateString('ko-KR')}까지 참여할 수 있는 초대예요.`} icon />
                        <AcceptInvitation token={code} claimable={invite.claimable} userName={name} />
                    </div>
                ) : (
                    <form onSubmit={findInvite} className="flex flex-1 flex-col">
                        <Heading eyebrow="초대 코드" title="받은 코드를 입력하세요" description="예: K7QM-2ZPA · 초대 링크를 붙여 넣어도 돼요." />
                        <label htmlFor="onboarding-code" className="sr-only">초대 코드</label>
                        <input id="onboarding-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={200} autoCapitalize="characters" autoComplete="off" spellCheck={false} className={cn(INPUT, 'font-semibold tracking-[0.2em] placeholder:tracking-normal')} placeholder="8자리 코드" autoFocus />
                        <ErrorLine error={error} />
                        <div className="mt-auto pt-8 sm:mt-8 sm:pt-0">
                            <Button type="submit" size="lg" className="w-full" disabled={pending || !code.trim()}>
                                {pending ? '찾는 중…' : '팀 찾기'}
                            </Button>
                        </div>
                    </form>
                )}
            </section>
        </main>
    );
}

function StepDots({ step }: { step: Step }) {
    return (
        <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className={cn('h-1.5 rounded-full transition-all', step === 'name' ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/25')} />
            <span className={cn('h-1.5 rounded-full transition-all', step === 'team' ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/25')} />
        </span>
    );
}

function Heading({ eyebrow, title, description, icon = false }: { eyebrow: string; title: string; description: string; icon?: boolean }) {
    return (
        <div className="mb-6 mt-6">
            {icon ? <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground"><UsersRound className="size-[22px]" aria-hidden="true" /></div> : null}
            <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
    );
}

function Choice({ icon, title, body, onClick }: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex min-h-[72px] w-full items-center gap-4 rounded-2xl px-4 text-left ring-1 ring-border transition-colors hover:bg-muted/60">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold tracking-tight text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{body}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
    );
}

function ErrorLine({ error }: { error: string }) {
    return error ? <Notice tone="error" className="mt-3">{error}</Notice> : null;
}
