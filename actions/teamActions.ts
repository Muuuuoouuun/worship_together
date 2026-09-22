'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { getTeamRepository, invitationOrigin } from '@/lib/server/teams';
import type { TeamActionResult, TeamIdentity, TeamMember, WorshipRole } from '@/types/team';

async function user(): Promise<TeamIdentity> {
    const current = await getCurrentUser();
    if (!current) throw new Error('로그인 후 다시 시도해주세요.');
    return current;
}
function errorResult(error: unknown): { ok: false; error: string } {
    console.error('Team action error:', error);
    const message = error instanceof Error ? error.message : '';
    return { ok: false, error: message || '저장하지 못했습니다. 잠시 후 다시 시도해주세요.' };
}
export async function createOnlineTeam(name: string): Promise<TeamActionResult<{ teamId: string }>> {
    try {
        const actor = await user();
        if (typeof name !== 'string') throw new Error('팀 이름을 확인해주세요.');
        const team = getTeamRepository().create(name, actor);
        revalidatePath('/dashboard/team');
        return { ok: true, value: { teamId: team.id } };
    } catch (error) { return errorResult(error); }
}
export async function issueTeamInvitation(teamId: string): Promise<TeamActionResult<{ url: string; expiresAt: string }>> {
    try {
        const actor = await user();
        const origin = invitationOrigin();
        const invitation = getTeamRepository().createInvite(teamId, actor.id);
        return { ok: true, value: { url: `${origin}/invite/${invitation.token}`, expiresAt: invitation.expiresAt } };
    } catch (error) { return errorResult(error); }
}
export async function revokeTeamInvitation(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().revokeInvites(teamId, actor.id);
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function acceptTeamInvitation(token: string): Promise<TeamActionResult<{ teamId: string }>> {
    try {
        const actor = await user();
        if (typeof token !== 'string') throw new Error('초대 링크를 확인해주세요.');
        const teamId = getTeamRepository().join(token, actor);
        revalidatePath('/dashboard/team');
        return { ok: true, value: { teamId } };
    } catch (error) { return errorResult(error); }
}
export async function setOnlineMemberRole(teamId: string, memberId: string, role: WorshipRole): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().assignRole(teamId, actor.id, memberId, role);
        revalidatePath('/dashboard/team');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function addOnlineMember(teamId: string, name: string, role: WorshipRole): Promise<TeamActionResult<TeamMember>> {
    try {
        const actor = await user();
        const member = getTeamRepository().addMemberDirect(teamId, actor.id, name, role);
        revalidatePath('/dashboard/team');
        return { ok: true, value: member };
    } catch (error) { return errorResult(error); }
}
export async function addOnlineMembersBatch(teamId: string, items: Array<{ name: string; role: WorshipRole }>): Promise<TeamActionResult<TeamMember[]>> {
    try {
        const actor = await user();
        const added = getTeamRepository().addMembersBatch(teamId, actor.id, items);
        revalidatePath('/dashboard/team');
        return { ok: true, value: added };
    } catch (error) { return errorResult(error); }
}
export async function setOnlineMemberPermission(teamId: string, targetUserId: string, permission: 'owner' | 'member'): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().setMemberPermission(teamId, actor.id, targetUserId, permission);
        revalidatePath('/dashboard/team');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function removeOnlineMember(teamId: string, targetUserId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().removeMember(teamId, actor.id, targetUserId);
        revalidatePath('/dashboard/team');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function leaveOnlineTeam(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().leaveTeam(teamId, actor.id);
        revalidatePath('/dashboard/team');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function deleteOnlineTeam(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().deleteTeam(teamId, actor.id);
        revalidatePath('/dashboard/team');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
