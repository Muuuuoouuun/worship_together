'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { getTeamEvents, getTeamRepository, invitationOrigin } from '@/lib/server/teams';
import { TEAM_COOKIE } from '@/lib/server/viewer';
import type { TeamPolicy } from '@/lib/permissions';
import type { InvitationPreview, TeamActionResult, TeamIdentity, TeamMember, UserProfile, WorshipRole } from '@/types/team';

/** 로그인한 사람 — 팀 명단에는 직접 고친 프로필 이름을 씁니다. */
async function user(): Promise<TeamIdentity> {
    const current = await getCurrentUser();
    if (!current) throw new Error('로그인 후 다시 시도해주세요.');
    const profile = getTeamRepository().ensureUser(current);
    return { id: current.id, name: profile.name };
}
function errorResult(error: unknown): { ok: false; error: string } {
    console.error('Team action error:', error);
    const message = error instanceof Error ? error.message : '';
    return { ok: false, error: message || '저장하지 못했습니다. 잠시 후 다시 시도해주세요.' };
}
/** 팀 명단 · 권한이 바뀌었음을 열려 있는 화면들에 알립니다. */
function teamChanged(teamId: string, reason: string) {
    try { getTeamEvents().publish(teamId, 'team.changed', { reason }); } catch (error) { console.error('[team] event', error); }
    revalidatePath('/', 'layout');
}
async function rememberTeam(teamId: string) {
    (await cookies()).set(TEAM_COOKIE, teamId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === 'production' });
}

export async function createOnlineTeam(name: string): Promise<TeamActionResult<{ teamId: string }>> {
    try {
        const actor = await user();
        if (typeof name !== 'string') throw new Error('팀 이름을 확인해주세요.');
        const repository = getTeamRepository();
        const team = repository.create(name, actor);
        repository.markOnboarded(actor.id);
        await rememberTeam(team.id);
        revalidatePath('/', 'layout');
        return { ok: true, value: { teamId: team.id } };
    } catch (error) { return errorResult(error); }
}
/** 지금 팀 바꾸기 — 모든 화면(홈 · 콘티 · 일정 · 팀 · 예배)이 이 팀을 봅니다. */
export async function selectTeam(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        if (typeof teamId !== 'string' || !getTeamRepository().membership(teamId, actor.id)) throw new Error('이 팀에 접근할 수 없습니다.');
        await rememberTeam(teamId);
        revalidatePath('/', 'layout');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function updateProfileName(name: string): Promise<TeamActionResult<UserProfile>> {
    try {
        const actor = await user();
        const repository = getTeamRepository();
        const profile = repository.updateProfile(actor.id, typeof name === 'string' ? name : '');
        for (const team of repository.list(actor.id)) teamChanged(team.id, 'profile');
        return { ok: true, value: profile };
    } catch (error) { return errorResult(error); }
}
export async function completeOnboarding(): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().markOnboarded(actor.id);
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function issueTeamInvitation(teamId: string): Promise<TeamActionResult<{ url: string; code: string; expiresAt: string }>> {
    try {
        const actor = await user();
        const origin = invitationOrigin();
        const invitation = getTeamRepository().createInvite(teamId, actor.id);
        return { ok: true, value: { url: `${origin}/invite/${invitation.token}`, code: invitation.code, expiresAt: invitation.expiresAt } };
    } catch (error) { return errorResult(error); }
}
export async function revokeTeamInvitation(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().revokeInvites(teamId, actor.id);
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
/** 초대 코드(또는 링크)로 어떤 팀인지 먼저 보여 줍니다. */
export async function previewInvitation(codeOrToken: string): Promise<TeamActionResult<InvitationPreview>> {
    try {
        await user();
        const value = typeof codeOrToken === 'string' ? codeOrToken.trim().replace(/^.*\/invite\//, '') : '';
        const preview = getTeamRepository().preview(value);
        if (!preview) throw new Error('초대 코드를 찾지 못했습니다. 만료되었거나 잘못 입력했을 수 있어요.');
        return { ok: true, value: preview };
    } catch (error) { return errorResult(error); }
}
export async function acceptTeamInvitation(token: string, claimMemberId?: string): Promise<TeamActionResult<{ teamId: string }>> {
    try {
        const actor = await user();
        if (typeof token !== 'string') throw new Error('초대 링크를 확인해주세요.');
        const repository = getTeamRepository();
        const teamId = repository.join(token.trim().replace(/^.*\/invite\//, ''), actor, typeof claimMemberId === 'string' && claimMemberId ? claimMemberId : undefined);
        repository.markOnboarded(actor.id);
        await rememberTeam(teamId);
        teamChanged(teamId, 'joined');
        return { ok: true, value: { teamId } };
    } catch (error) { return errorResult(error); }
}
export async function setTeamPolicy(teamId: string, policy: TeamPolicy): Promise<TeamActionResult<TeamPolicy>> {
    try {
        const actor = await user();
        const value = getTeamRepository().setPolicy(teamId, actor.id, policy);
        teamChanged(teamId, 'policy');
        return { ok: true, value };
    } catch (error) { return errorResult(error); }
}
export async function setOnlineMemberRole(teamId: string, memberId: string, role: WorshipRole): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().assignRole(teamId, actor.id, memberId, role);
        teamChanged(teamId, 'role');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function addOnlineMember(teamId: string, name: string, role: WorshipRole): Promise<TeamActionResult<TeamMember>> {
    try {
        const actor = await user();
        const member = getTeamRepository().addMemberDirect(teamId, actor.id, name, role);
        teamChanged(teamId, 'member');
        return { ok: true, value: member };
    } catch (error) { return errorResult(error); }
}
export async function addOnlineMembersBatch(teamId: string, items: Array<{ name: string; role: WorshipRole }>): Promise<TeamActionResult<TeamMember[]>> {
    try {
        const actor = await user();
        const added = getTeamRepository().addMembersBatch(teamId, actor.id, items);
        teamChanged(teamId, 'member');
        return { ok: true, value: added };
    } catch (error) { return errorResult(error); }
}
export async function setOnlineMemberPermission(teamId: string, targetUserId: string, permission: 'owner' | 'member'): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().setMemberPermission(teamId, actor.id, targetUserId, permission);
        teamChanged(teamId, 'permission');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function removeOnlineMember(teamId: string, targetUserId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().removeMember(teamId, actor.id, targetUserId);
        teamChanged(teamId, 'removed');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function leaveOnlineTeam(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        getTeamRepository().leaveTeam(teamId, actor.id);
        teamChanged(teamId, 'left');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
export async function deleteOnlineTeam(teamId: string): Promise<TeamActionResult> {
    try {
        const actor = await user();
        // 지우기 전에 열린 화면들에 먼저 알립니다 (팀이 지워지면 소식도 함께 지워집니다).
        if (getTeamRepository().membership(teamId, actor.id)?.permission === 'owner') teamChanged(teamId, 'deleted');
        getTeamRepository().deleteTeam(teamId, actor.id);
        revalidatePath('/', 'layout');
        return { ok: true, value: undefined };
    } catch (error) { return errorResult(error); }
}
