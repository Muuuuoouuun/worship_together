'use server';

import { getCurrentUser } from '@/lib/auth';
import { getTeamEvents, getTeamRepository } from '@/lib/server/teams';
import type { PlanningCommand, PlanningState } from '@/types/planning';
import type { TeamActionResult, TeamMember } from '@/types/team';

async function run(teamId: string, command?: PlanningCommand): Promise<TeamActionResult<PlanningState>> {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('로그인 후 다시 시도해주세요.');
        if (typeof teamId !== 'string' || !teamId || teamId.length > 200) throw new Error('팀을 확인해주세요.');
        const repository = getTeamRepository();
        if (command === undefined) return { ok: true, value: repository.planning(teamId, user.id) };
        const value = repository.updatePlanning(teamId, user.id, command);
        // 일정 · 요청 · 소식을 보고 있는 다른 팀원 화면이 바로 다시 읽습니다.
        getTeamEvents().publish(teamId, 'planning.changed', { by: user.id });
        return { ok: true, value };
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        return { ok: false, error: /[가-힣]/.test(message) ? message : '저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.' };
    }
}
export async function loadTeamPlanning(teamId: string) { return run(teamId); }
export async function loadPlanningContext(teamId: string): Promise<TeamActionResult<{ state: PlanningState; members: TeamMember[] }>> {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: '로그인 후 다시 시도해주세요.' };
    try {
        const repository = getTeamRepository();
        const team = repository.list(user.id).find(item => item.id === teamId);
        if (!team) throw new Error('이 팀에 접근할 수 없습니다.');
        return { ok: true, value: { state: repository.planning(teamId, user.id), members: team.members } };
    } catch (error) { return { ok: false, error: error instanceof Error && /[가-힣]/.test(error.message) ? error.message : '팀 자료를 읽지 못했습니다.' }; }
}
export async function updateTeamPlanning(teamId: string, command: PlanningCommand) { return run(teamId, command); }
export async function loadPlanningInbox(): Promise<TeamActionResult<{ count: number; urgent: number; teamId?: string; target?: string; title?: string }>> {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: '로그인 후 알림을 확인해주세요.' };
    try {
        const repository = getTeamRepository();
        const unread = repository.list(user.id).flatMap(team => repository.planning(team.id, user.id).notifications.filter(item => !item.readBy.includes(user.id)).map(item => ({ ...item, teamId: team.id })));
        unread.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
        const first = unread[0];
        return { ok: true, value: { count: unread.length, urgent: unread.filter(item => item.urgent).length, teamId: first?.teamId, target: first?.target, title: first?.title } };
    } catch { return { ok: false, error: '새 알림을 확인하지 못했습니다.' }; }
}
