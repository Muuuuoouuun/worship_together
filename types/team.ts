export const worshipRoles = { leader: '인도자', vocal: '보컬', keyboard: '건반', guitar: '기타', bass: '베이스', drums: '드럼', sound: '음향', media: '영상·자막', member: '미정' } as const;
export type WorshipRole = keyof typeof worshipRoles;
export type TeamMember = { userId: string; name: string; role: WorshipRole; permission: 'owner' | 'member' };
/** 관리자가 이름만 먼저 올려 둔 명단 자리 (아직 계정으로 들어오지 않아 알림을 볼 수 없음) */
export const PLACEHOLDER_MEMBER_PREFIX = 'direct-';
export const isPlaceholderMember = (userId: string) => userId.startsWith(PLACEHOLDER_MEMBER_PREFIX);
export type OnlineTeam = { id: string; name: string; ownerId: string; members: TeamMember[]; createdAt: string };
export type TeamIdentity = { id: string; name: string };
export type InvitationPreview = { teamId: string; teamName: string; expiresAt: string; claimable: { userId: string; name: string; role: WorshipRole }[] };
export type UserProfile = { id: string; name: string; createdAt: string; onboardedAt: string | null };
export type TeamActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
