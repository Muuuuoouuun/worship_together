import type { Metadata } from 'next';
import Notice from '@/components/ui/Notice';
import PageHeader from '@/components/ui/PageHeader';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import LibraryTeamWorkspace from '@/components/library/LibraryTeamWorkspace';
import { getViewer } from '@/lib/server/viewer';
import { can } from '@/lib/permissions';

export const metadata: Metadata = {
    title: '곡 보관함',
};

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

export default async function SongArchivePage({ searchParams }: LibraryPageProps) {
    const params = await searchParams;
    const [songs, setlists, viewer] = await Promise.all([getSongsByTeam(DEMO_TEAM_ID), getSetlistsByTeam(DEMO_TEAM_ID, { withSongs: false }), getViewer(getParam(params.team))]);
    const hasSupabase = Boolean(supabase);
    const onlineTeams = viewer ? viewer.teams.map(team => ({ id: team.id, name: team.name })) : [];
    const createdKey = getParam(params.created);
    const errorKey = getParam(params.error);

    return (
        <>
            <div className="flex flex-col gap-6">
                <PageHeader back={{ href: '/dashboard/songs', label: '콘티·악보' }} title="곡 보관함" description="곡 등록·송폼·BPM 관리와 콘티 만들기" />

                {createdKey && successMessages[createdKey] && <Notice tone="success">{successMessages[createdKey]}</Notice>}
                {errorKey && errorMessages[errorKey] && <Notice tone="error">{errorMessages[errorKey]}</Notice>}

                <LibraryTeamWorkspace initialSongs={withoutMusicXml(songs)} initialSetlists={setlists} teamId={DEMO_TEAM_ID} hasBackend={hasSupabase} onlineTeams={onlineTeams} onlineTeamId={viewer?.team?.id} canEditConti={viewer?.member ? can(viewer.member, viewer.policy, 'contiEdit') : true} />
            </div>
        </>
    );
}

/** 악보 XML 은 이 화면에서 쓰지 않으므로 브라우저로 보내지 않습니다. */
function withoutMusicXml<T extends { data_xml: string | null }>(songs: T[]): T[] {
    return songs.map((song) => ({ ...song, data_xml: null }));
}

function getParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return null;
}
