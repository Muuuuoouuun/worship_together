import 'server-only';
import path from 'node:path';
import { TeamRepository } from './teamRepository';
import { TeamEvents } from './teamEvents';
import { TeamDocs } from './teamDocs';
import { LiveRepository } from './liveRepository';
import { getCurrentUser } from '@/lib/auth';

/**
 * 저장소 코드가 바뀌면 올립니다 — 개발 서버가 예전 객체를 계속 쓰지 않게.
 * (Next 는 라우트 핸들러와 서버 컴포넌트에서 이 모듈을 따로 읽으므로, 모듈마다 다른 표식이 아니라 같은 숫자여야 같은 객체를 나눠 씁니다.)
 */
const STORE_VERSION = 4;
type Stores = { teams: TeamRepository; events: TeamEvents; docs: TeamDocs; live: LiveRepository; sweeper: ReturnType<typeof setInterval> };
const globalStores = globalThis as unknown as { worshipStores?: Stores; worshipStoresVersion?: number; worshipTeamRepository?: TeamRepository };

/** 한 서버 프로세스가 같은 SQLite 파일을 한 번만 엽니다 (개발 중 새로고침에도 유지). */
function stores(): Stores {
    if (!globalStores.worshipStores || globalStores.worshipStoresVersion !== STORE_VERSION) {
        if (globalStores.worshipStores) {
            clearInterval(globalStores.worshipStores.sweeper);
            globalStores.worshipStores.teams.close();
        }
        globalStores.worshipTeamRepository?.close();
        globalStores.worshipTeamRepository = undefined;
        const teams = new TeamRepository(process.env.TEAM_DATABASE_PATH || path.join(process.cwd(), '.data', 'teams.sqlite'));
        const events = new TeamEvents(teams.database);
        const live = new LiveRepository(teams.database, teams, events);
        const docs = new TeamDocs(teams.database, teams, events);
        // 화면을 닫은 기기(소식이 끊긴 기기)를 예배 세션에서 내보냅니다.
        const sweeper = setInterval(() => { try { live.sweep(); } catch (error) { console.error('[live] sweep', error); } }, 15_000);
        sweeper.unref?.();
        globalStores.worshipStores = { teams, events, docs, live, sweeper };
        globalStores.worshipStoresVersion = STORE_VERSION;
    }
    return globalStores.worshipStores;
}

export function getTeamRepository() { return stores().teams; }
export function getTeamEvents() { return stores().events; }
export function getTeamDocs() { return stores().docs; }
export function getLiveRepository() { return stores().live; }

export async function getOnlineTeamName(teamId: unknown): Promise<string | undefined> {
    if (typeof teamId !== 'string') return undefined;
    const user = await getCurrentUser();
    return user ? getTeamRepository().list(user.id).find(team => team.id === teamId)?.name : undefined;
}
export function invitationOrigin(): string {
    const configured = process.env.NEXTAUTH_URL;
    if (!configured && process.env.NODE_ENV === 'production') throw new Error('서비스 주소가 설정되지 않았습니다.');
    const url = new URL(configured || 'http://localhost:4000');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('서비스 주소 설정을 확인해주세요.');
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('공개 서비스에는 HTTPS 주소를 설정해주세요.');
    return url.origin;
}
