'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setTeamPolicy } from '@/actions/teamActions';
import { showAppToast } from '@/lib/appToast';
import { POLICY_ITEMS, POLICY_LEVELS, POLICY_LEVEL_LABEL, can, type PolicyLevel, type TeamPolicy } from '@/lib/permissions';
import type { TeamMember } from '@/types/team';

/**
 * 팀 권한 — 누가 콘티를 고치고, 예배를 진행하고, 전체 큐를 보내는지.
 * 관리자는 바꿀 수 있고, 팀원은 자기에게 허락된 것을 확인합니다. 저장하면 서버가 같은 규칙으로 검사합니다.
 */
export default function TeamPolicyPanel({ teamId, policy, me, titleClassName }: { teamId: string; policy: TeamPolicy; me: TeamMember; titleClassName: string }) {
    const router = useRouter();
    const [value, setValue] = useState(policy);
    const [pending, startTransition] = useTransition();
    const admin = me.permission === 'owner';
    // 서버 값이 바뀌면(다른 관리자가 바꿈) 따라갑니다.
    const [seen, setSeen] = useState(policy);
    if (seen !== policy) {
        setSeen(policy);
        setValue(policy);
    }

    function change(key: keyof TeamPolicy, level: PolicyLevel) {
        const before = value;
        const next = { ...value, [key]: level };
        setValue(next);
        startTransition(async () => {
            const result = await setTeamPolicy(teamId, next);
            if (!result.ok) {
                setValue(before);
                showAppToast({ tone: 'danger', title: result.error });
                return;
            }
            showAppToast({ group: 'policy', tone: 'success', title: '권한을 바꿨어요', body: '팀원 화면에도 바로 반영돼요', ttl: 2500 });
            router.refresh();
        });
    }

    return (
        <section aria-labelledby="team-policy" className="min-w-0">
            <h2 id="team-policy" className={titleClassName}>권한</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {admin ? '관리자는 언제나 모든 기능을 쓸 수 있어요. 인도자는 명단에서 역할이 ‘인도자’인 팀원이에요.' : '관리자가 정한 이 팀의 권한이에요.'}
            </p>
            <ul className="mt-4 divide-y divide-border/70 border-y border-border/70">
                {POLICY_ITEMS.map((item) => {
                    const allowed = can(me, value, item.key);
                    return (
                        <li key={item.key} className="py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] font-semibold tracking-tight text-foreground">{item.label}</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                                </div>
                                <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', allowed ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground')}>
                                    {allowed ? <Check className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
                                    {allowed ? '나도 가능' : '나는 불가'}
                                </span>
                            </div>
                            <div role="radiogroup" aria-label={`${item.label} 권한`} className="mt-3 grid grid-cols-3 rounded-full bg-muted p-1">
                                {POLICY_LEVELS.map((level) => {
                                    const active = value[item.key] === level;
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            disabled={!admin || pending}
                                            onClick={() => change(item.key, level)}
                                            className={cn(
                                                'relative inline-flex h-9 min-w-0 items-center justify-center rounded-full px-2 text-xs transition-colors after:absolute after:inset-x-0 after:-inset-y-1 disabled:cursor-default',
                                                active ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground enabled:hover:text-foreground',
                                            )}
                                        >
                                            <span className="truncate">{POLICY_LEVEL_LABEL[level]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
