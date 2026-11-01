import 'server-only';
import path from 'node:path';
import { TeamRepository } from './teamRepository';
import { TeamEvents } from './teamEvents';
import { TeamDocs } from './teamDocs';
import { LiveRepository } from './liveRepository';
import { contiSaveHook, deliverNotices, type NoticePush } from './notices';
import { PushStore, pushConfigFromEnv } from './push';
import webpush from 'web-push';
import { liveHref, noticeHref } from '@/lib/noticeLinks';
import { isPlaceholderMember } from '@/types/team';
import type { PlanningNotification } from '@/types/planning';
import { getCurrentUser } from '@/lib/auth';

/**
 * 저장소 코드가 바뀌면 올립니다 — 개발 서버가 예전 객체를 계속 쓰지 않게.
 * (Next 는 라우트 핸들러와 서버 컴포넌트에서 이 모듈을 따로 읽으므로, 모듈마다 다른 표식이 아니라 같은 숫자여야 같은 객체를 나눠 씁니다.)
 */
const STORE_VERSION = 6;
type Stores = { teams: TeamRepository; events: TeamEvents; docs: TeamDocs; live: LiveRepository; push: PushStore; sweeper: ReturnType<typeof setInterval> };
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
        const config = pushConfigFromEnv();
        const push = new PushStore(teams.database, config, config ? (subscription, payload, options) => webpush.sendNotification(subscription, payload, { ...options, vapidDetails: config }) : null);
        const noticePush = pushNotices(teams, push);
        docs.afterSave = contiSaveHook(teams, docs, events, () => noticePush);
        live.afterStart = (session, starterId) => {
            const members = teams.planningSnapshot(session.teamId).members.map((member) => member.userId).filter((id) => id !== starterId && !isPlaceholderMember(id));
            const teamName = teams.teamName(session.teamId);
            void push.send(members, { title: `${teamName ? `${teamName} · ` : ''}예배가 시작됐어요`, body: `${session.startedByName}님 · ${session.title}`, url: liveHref(session.id), tag: `live-${session.id}`, urgent: true });
        };
        // 화면을 닫은 기기(소식이 끊긴 기기)를 예배 세션에서 내보냅니다.
        const sweeper = setInterval(() => { try { live.sweep(); } catch (error) { console.error('[live] sweep', error); } }, 15_000);
        sweeper.unref?.();
        globalStores.worshipStores = { teams, events, docs, live, push, sweeper };
        globalStores.worshipStoresVersion = STORE_VERSION;
    }
    return globalStores.worshipStores;
}

export function getTeamRepository() { return stores().teams; }
export function getTeamEvents() { return stores().events; }
export function getTeamDocs() { return stores().docs; }
export function getLiveRepository() { return stores().live; }
export function getPushStore() { return stores().push; }
/** 새 알림을 받는 사람에게 보냅니다 (팀 소식 · 앱을 닫은 기기에는 푸시) */
export function deliverTeamNotices(teamId: string, created: PlanningNotification[], byId: string) {
    const { events, teams, push } = stores();
    deliverNotices(events, teamId, created, byId, pushNotices(teams, push));
}

/** 알림 하나를 푸시로 — 제목은 알림 제목, 내용 앞에 팀 이름 (여러 팀을 섬기는 사람이 구분하게) */
function pushNotices(teams: TeamRepository, push: PushStore): NoticePush | null {
    if (!push.publicKey) return null;
    return (recipients, notice) => {
        const teamName = teams.teamName(notice.teamId);
        void push.send(recipients, { title: notice.title, body: teamName ? `${teamName} · ${notice.body}` : notice.body, url: noticeHref(notice.teamId, notice), tag: `plan-${notice.id}`, urgent: notice.urgent });
    };
}

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
