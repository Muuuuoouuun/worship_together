import type { ComponentType } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SongBpmPresetManager from '@/components/library/SongBpmPresetManager';
import SongComposer from '@/components/library/SongComposer';
import SongLibraryList from '@/components/library/SongLibraryList';
import SetlistComposer from '@/components/library/SetlistComposer';
import SetlistTimeline from '@/components/library/SetlistTimeline';
import SongUsageInsights from '@/components/library/SongUsageInsights';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { CalendarRange, Music4, RadioTower } from 'lucide-react';

interface LibraryPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const successMessages: Record<string, string> = {
    bpm: '곡 BPM 프리셋을 업데이트했습니다.',
    song: '곡을 라이브러리에 저장했습니다.',
    setlist: '콘티를 일정에 추가했습니다.',
    template: '콘티를 다음 주 템플릿으로 복제했습니다.',
};

const errorMessages: Record<string, string> = {
    'missing-song-id': 'Song target is missing.',
    'missing-song-title': '곡명이 필요합니다.',
    'invalid-bpm': 'BPM은 양수여야 합니다.',
    'create-song': '곡을 저장하지 못했습니다. Supabase 권한을 확인해주세요.',
    'update-song-bpm': 'BPM 프리셋을 저장하지 못했습니다. Supabase 권한을 확인해주세요.',
    'missing-setlist-title': '콘티 제목이 필요합니다.',
    'missing-setlist-id': '콘티 대상이 없습니다.',
    'missing-worship-date': '예배 일시가 필요합니다.',
    'invalid-worship-date': '예배 일시 형식이 올바르지 않습니다.',
    'create-setlist': '콘티를 저장하지 못했습니다. Supabase 권한을 확인해주세요.',
    'duplicate-setlist': '콘티를 복제하지 못했습니다. Supabase 권한을 확인해주세요.',
};

export default async function SongLibraryPage({ searchParams }: LibraryPageProps) {
    const params = await searchParams;
    const [songs, setlists] = await Promise.all([
        getSongsByTeam(DEMO_TEAM_ID),
        getSetlistsByTeam(DEMO_TEAM_ID),
    ]);
    const hasSupabase = Boolean(supabase);
    const createdKey = getParam(params.created);
    const errorKey = getParam(params.error);

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <MeshBackground />
            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-secondary">
                            콘티 워크스페이스
                        </span>
                        <div>
                            <h1 className="text-4xl font-serif font-black tracking-tight text-primary md:text-5xl">
                                악보, 콘티, 예배 준비
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-primary/55 md:text-base">
                                라이브 예배 세션의 기반이 되는 곡, BPM, 악보, 콘티를 준비합니다.
                            </p>
                        </div>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
                        <MetricCard icon={Music4} label="곡" value={songs.length} />
                        <MetricCard icon={CalendarRange} label="콘티" value={setlists.length} />
                        <MetricCard
                            icon={RadioTower}
                            label="라이브 가능"
                            value={setlists.filter((setlist) => setlist.songs.length > 0).length}
                        />
                    </div>
                </section>

                {createdKey && successMessages[createdKey] && (
                    <GlassCard className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                        <p className="text-sm font-semibold">{successMessages[createdKey]}</p>
                    </GlassCard>
                )}

                {errorKey && errorMessages[errorKey] && (
                    <GlassCard className="border-red-500/20 bg-red-500/10 text-red-600">
                        <p className="text-sm font-semibold">{errorMessages[errorKey]}</p>
                    </GlassCard>
                )}

                {!hasSupabase && (
                    <GlassCard className="border-amber-500/20 bg-amber-500/10">
                        <p className="text-sm font-semibold text-amber-700">데모 모드로 보는 중입니다.</p>
                        <p className="mt-2 text-sm leading-relaxed text-amber-700/80">
                            곡과 콘티 화면은 확인할 수 있고, 생성 버튼은 Supabase 연결 후 활성화됩니다.
                        </p>
                    </GlassCard>
                )}

                <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="space-y-6">
                        <SongComposer disabled={!hasSupabase} />
                        <SetlistComposer songs={songs} disabled={!hasSupabase} />
                    </div>

                    <div className="space-y-6">
                        <SongBpmPresetManager songs={songs} disabled={!hasSupabase} />
                        <SongUsageInsights songs={songs} setlists={setlists} />
                        <SongLibraryList songs={songs} />
                        <SetlistTimeline setlists={setlists} />
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ size?: number }>;
    label: string;
    value: number;
}) {
    return (
        <GlassCard className="border-primary/10 px-5 py-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary/60">
                    <Icon size={18} />
                </div>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/35">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-primary">{value}</p>
                </div>
            </div>
        </GlassCard>
    );
}

function getParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return null;
}
