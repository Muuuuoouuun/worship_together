import type { Metadata } from 'next';
import LiveContiWorkspace from '@/components/conti/LiveContiWorkspace';
import { resolveScreen } from '@/components/conti/model';
import { getLiveContiInputs } from '@/lib/server/contiInputs';

export const metadata: Metadata = {
    title: '콘티·악보',
};

interface SongsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SongsPage({ searchParams }: SongsPageProps) {
    const params = await searchParams;
    const tab = typeof params.tab === 'string' ? params.tab : '';
    const setlist = typeof params.setlist === 'string' && params.setlist ? params.setlist : undefined;
    const team = typeof params.team === 'string' && params.team ? params.team : undefined;
    const { screen, setlistId } = resolveScreen(tab, setlist);

    // 곡 보관함과 같은 데이터를 같은 규칙으로 읽습니다.
    const inputs = await getLiveContiInputs(team);

    return <LiveContiWorkspace {...inputs} initialScreen={screen} initialSetlistId={setlistId} />;
}
