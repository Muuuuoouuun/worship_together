'use client';

import Link from 'next/link';
import { Library } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { buttonVariants } from '@/components/ui/button';
import ContiWorkspace from './ContiWorkspace';
import type { ScreenId } from './model';
import { useLiveContiData, type LiveContiInputs } from './useLiveContiData';

interface Props extends LiveContiInputs {
    initialScreen: ScreenId;
    initialSetlistId?: string;
}

export default function LiveContiWorkspace(props: Props) {
    const { data, loading, error, source, chooseTeam, chooseViewer, teamError, localViewerId } = useLiveContiData(props);

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="콘티·악보"
                description={
                    <>
                        {source.kind === 'server' ? '서버에 저장된 콘티' : '곡 보관함에 저장된 콘티'}를 이번 주 순서·송폼·특이사항과 함께 봐요
                        <Link href="/dashboard/songs/deadline" className="ml-1.5 inline-flex items-center text-xs font-semibold text-brand underline-offset-2 hover:underline">
                            마감 알림 목업 →
                        </Link>
                    </>
                }
                actions={
                    <>
                    {source.teams.length > 1 && (
                        <label className="sr-only" htmlFor="conti-team">
                            팀 선택
                        </label>
                    )}
                    {source.teams.length > 1 && (
                        <select
                            id="conti-team"
                            value={source.teamId}
                            onChange={(event) => chooseTeam(event.target.value)}
                            className="h-9 max-w-40 rounded-full border border-border bg-card px-3 text-base font-semibold text-foreground sm:text-xs"
                        >
                            {source.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {localViewerId && source.viewers.length > 1 && (
                        <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card pl-3.5 pr-2 text-xs font-semibold text-foreground focus-within:ring-2 focus-within:ring-ring/30">
                            <span className="text-muted-foreground">보는 사람</span>
                            <select
                                aria-label="보는 사람"
                                value={localViewerId}
                                onChange={(event) => chooseViewer(event.target.value)}
                                className="max-w-32 bg-transparent text-base font-semibold text-foreground outline-none sm:text-xs"
                            >
                                {source.viewers.map((member) => (
                                    <option key={member.userId} value={member.userId}>
                                        {member.name}
                                        {member.permission === 'owner' ? ' · 관리자' : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <Link href="/dashboard/songs/library" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        <Library size={15} aria-hidden="true" />
                        곡 보관함
                    </Link>
                    </>
                }
            />
            {teamError && <p role="alert" className="px-1 text-sm text-destructive">{teamError}</p>}

            {loading ? (
                <div role="status" className="max-w-3xl rounded-3xl bg-muted/60 px-6 py-16 text-center text-sm text-muted-foreground">
                    콘티를 불러오는 중…
                </div>
            ) : error !== null ? (
                <div role="alert" className="max-w-3xl rounded-3xl bg-destructive/10 px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-foreground">{error}</p>
                    <Link href="/dashboard/songs/library" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand underline-offset-2 hover:underline">
                        곡 보관함에서 확인하기
                    </Link>
                </div>
            ) : (
                data && <ContiWorkspace key={source.teamId} data={data} mode="embedded" initialScreen={props.initialScreen} initialSetlistId={props.initialSetlistId} />
            )}
        </div>
    );
}
