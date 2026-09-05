import 'server-only';
import path from 'node:path';
import { TeamRepository } from './teamRepository';
import { getCurrentUser } from '@/lib/auth';

const globalTeams = globalThis as unknown as { worshipTeamRepository?: TeamRepository; worshipTeamRepositoryVersion?: number };
export async function getOnlineTeamName(teamId: unknown): Promise<string | undefined> {
    if (typeof teamId !== 'string') return undefined;
    const user = await getCurrentUser();
    return user ? getTeamRepository().list(user.id).find(team => team.id === teamId)?.name : undefined;
}
export function getTeamRepository() {
    if (!globalTeams.worshipTeamRepository || globalTeams.worshipTeamRepositoryVersion !== 2) {
        globalTeams.worshipTeamRepository?.close();
        globalTeams.worshipTeamRepository = new TeamRepository(process.env.TEAM_DATABASE_PATH || path.join(process.cwd(), '.data', 'teams.sqlite'));
        globalTeams.worshipTeamRepositoryVersion = 2;
    }
    return globalTeams.worshipTeamRepository;
}
export function invitationOrigin(): string {
    const configured = process.env.NEXTAUTH_URL;
    if (!configured && process.env.NODE_ENV === 'production') throw new Error('서비스 주소가 설정되지 않았습니다.');
    const url = new URL(configured || 'http://localhost:4000');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('서비스 주소 설정을 확인해주세요.');
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('공개 서비스에는 HTTPS 주소를 설정해주세요.');
    return url.origin;
}
