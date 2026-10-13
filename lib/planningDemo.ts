import type { TeamMember } from '@/types/team';

/** 로그인·팀 등록 없이 일정·요청을 체험할 때 쓰는 예시 팀원 */
export const demoMembers: TeamMember[] = [
    { userId: 'demo-leader', name: '예시 인도자', role: 'leader', permission: 'owner' },
    { userId: 'demo-vocal', name: '예시 보컬', role: 'vocal', permission: 'member' },
    { userId: 'demo-drums', name: '예시 드럼', role: 'drums', permission: 'member' },
    { userId: 'demo-guitar', name: '예시 기타', role: 'guitar', permission: 'member' },
];

export const planningStorageKey = (teamId: string) => `worship-planning:v1:${teamId}`;
export const PLANNING_CHANGED_EVENT = 'worship-planning-changed';

/** 로그인 없이 볼 때 '어느 팀원으로' 보는지. 콘티·악보 화면과 일정·요청 화면이 같이 씁니다. */
export const localActorStorageKey = (teamId: string) => `worship:conti-viewer:v1:${encodeURIComponent(teamId)}`;

export function readLocalActor(teamId: string): string {
    try {
        return localStorage.getItem(localActorStorageKey(teamId)) ?? '';
    } catch {
        return '';
    }
}

export function writeLocalActor(teamId: string, userId: string): void {
    try {
        localStorage.setItem(localActorStorageKey(teamId), userId);
    } catch {
        // 저장 공간 문제는 화면을 막지 않습니다.
    }
}
