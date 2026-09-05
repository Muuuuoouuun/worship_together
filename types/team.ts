export const worshipRoles = { leader: '인도자', vocal: '보컬', keyboard: '건반', guitar: '기타', bass: '베이스', drums: '드럼', sound: '음향', media: '영상·자막', member: '미정' } as const;
export type WorshipRole = keyof typeof worshipRoles;
export type TeamMember = { userId: string; name: string; role: WorshipRole; permission: 'owner' | 'member' };
export type OnlineTeam = { id: string; name: string; ownerId: string; members: TeamMember[]; createdAt: string };
export type TeamIdentity = { id: string; name: string };
export type InvitationPreview = { teamId: string; teamName: string; expiresAt: string };
export type TeamActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
