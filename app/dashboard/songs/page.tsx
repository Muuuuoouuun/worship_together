import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Link from 'next/link';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import LibraryTeamWorkspace from '@/components/library/LibraryTeamWorkspace';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository } from '@/lib/server/teams';

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
    'invalid-bpm': 'BPM은 20~300 사이 정수로 입력해주세요.',
    'backend-unavailable': '서버 저장 연결이 없습니다. 브라우저 프로토타입 모드에서 저장해주세요.',
    'invalid-setlist-songs': '콘티에 사용할 팀의 곡을 한 곡 이상 선택해주세요.',
    'duplicate-setlist-songs': '콘티에는 같은 곡을 한 번만 추가할 수 있습니다. 후렴 반복은 곡의 송폼에서 설정해주세요.',
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
    const user = await getCurrentUser();
    const onlineTeams = user ? getTeamRepository().list(user.id).map(team => ({ id: team.id, name: team.name })) : [];
    const createdKey = getParam(params.created);
    const errorKey = getParam(params.error);

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <MeshBackground />
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <section className="flex flex-wrap items-end justify-between gap-2">
                    <h1 className="text-2xl font-serif font-black tracking-tight text-primary sm:text-3xl">
                        콘티·악보
                    </h1>
                    <Link
                        href="/dashboard/songs/drafts"
                        className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
                    >
                        콘티·순서 디자인 시안 A·B·C
                    </Link>
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

                <LibraryTeamWorkspace initialSongs={songs} initialSetlists={setlists} teamId={DEMO_TEAM_ID} hasBackend={hasSupabase} onlineTeams={onlineTeams} onlineTeamId={getParam(params.team) ?? undefined} />
            </div>
        </DashboardLayout>
    );
}

function getParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return null;
}
