import { DEMO_TEAM_ID, isPrototypeSessionId } from './constants';
import { DEFAULT_POLICY, can, type TeamPolicy } from './permissions';
import type { TeamMember } from '../types/team';

/*
 * 예전 Supabase 경로(곡 보관함 서버 액션 · /session/[id] 읽기)의 권한 판단. 화면 · 서버 어디서나 쓸 수 있는 순수 함수입니다.
 * 온라인 팀은 서버 SQLite(lib/server/*)에 있고, Supabase 는 NEXT_PUBLIC_SUPABASE_URL 을 넣었을 때만 쓰는 예전 경로입니다.
 * Supabase 쪽에는 이 앱의 로그인과 이어진 팀 명단이 없으므로, 권한을 확인할 수 없는 팀은 막습니다(기본 거부).
 */

type Member = Pick<TeamMember, 'permission' | 'role'>;

/** 거부 이유 — 곡 보관함 화면의 ?error= 키로 그대로 씁니다 */
export type LibraryDenial = 'backend-unavailable' | 'sign-in-required' | 'library-forbidden';
export type LibraryAccess = { ok: true } | { ok: false; reason: LibraryDenial };

export const LIBRARY_DENIAL_MESSAGES: Record<Exclude<LibraryDenial, 'backend-unavailable'>, string> = {
    'sign-in-required': '로그인 후 다시 시도해주세요.',
    'library-forbidden': '이 팀의 곡을 바꿀 권한이 없어요.',
};

export interface LibraryAccessInput {
    /** 로그인한 사람 (없으면 null) */
    user: { id: string } | null;
    /** 바꾸려는 팀 (폼의 teamId) */
    teamId: string;
    /** 서버 SQLite 에 있는 온라인 팀인지 */
    isOnlineTeam: boolean;
    /** 그 온라인 팀에서 이 사람의 자리 (팀원이 아니면 null) */
    membership: Member | null;
    /** 그 온라인 팀의 권한 정책 (없으면 기본 정책) */
    policy?: TeamPolicy;
    /** Supabase 연결(NEXT_PUBLIC_SUPABASE_URL · ANON_KEY)이 있는지 */
    supabaseConfigured: boolean;
}

const deny = (reason: LibraryDenial): LibraryAccess => ({ ok: false, reason });

/**
 * 곡 · 콘티를 Supabase 에 만들거나 지우거나 바꿔도 되는지.
 * - Supabase 연결이 없으면 지금처럼 '서버 저장 연결 없음'(화면은 브라우저 저장으로 동작)
 * - 로그인하지 않았으면 거부
 * - 데모 팀(DEMO_TEAM_ID)은 주인이 없는 공용 예시라 거부
 * - 온라인 팀이면 팀원이어야 하고, 팀 정책의 '콘티 · 곡 편집' 권한이 있어야 함 (lib/server/teamDocs 와 같은 기준)
 * - 그 밖의 팀(브라우저 프로토타입 팀 · Supabase 에만 있는 팀)은 팀원인지 확인할 수 없어 거부
 */
export function canMutateLibrary(input: LibraryAccessInput): LibraryAccess {
    if (!input.supabaseConfigured) return deny('backend-unavailable');
    if (!input.user?.id) return deny('sign-in-required');
    if (!input.teamId || input.teamId === DEMO_TEAM_ID) return deny('library-forbidden');
    if (!input.isOnlineTeam || !input.membership) return deny('library-forbidden');
    if (!can(input.membership, input.policy ?? DEFAULT_POLICY, 'contiEdit')) return deny('library-forbidden');
    return { ok: true };
}

/** /session/[id] 가 Supabase 세션을 읽을 때 넘기는 보는 사람 정보 (lib/server/legacyAccess 가 만듭니다) */
export interface LegacySessionAccess {
    user: { id: string } | null;
    /** 그 팀(온라인 팀)에서 이 사람의 자리. 팀원이 아니거나 온라인 팀이 아니면 null */
    membershipOf(teamId: string): Member | null;
}

/**
 * 예배 화면(/session/[id])이 세션을 보여 줘도 되는지.
 * 데모 · 프로토타입 세션(이 기기에서만 도는 세션)은 누구나, 그 밖의 세션은 로그인한 그 팀의 팀원만.
 */
export function canReadLegacySession(input: { sessionId: string; user: { id: string } | null; teamId: string | null; membership: Member | null }): boolean {
    if (isPrototypeSessionId(input.sessionId)) return true;
    if (!input.user?.id || !input.teamId) return false;
    return Boolean(input.membership);
}
