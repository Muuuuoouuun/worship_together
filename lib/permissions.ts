import type { TeamMember } from '@/types/team';

/*
 * 팀 권한. 서버(저장 · 세션 진행 검사)와 화면(버튼 보이기)이 같은 규칙을 씁니다.
 * - 관리자(permission 'owner'): 팀 관리 · 모든 기능
 * - 인도자(역할 'leader'): 정책이 '관리자 + 인도자' 이상이면 해당 기능
 * - 모든 팀원: 정책이 '모든 팀원' 이면 해당 기능
 */

export type PolicyLevel = 'admins' | 'leaders' | 'everyone';

export interface TeamPolicy {
    /** 콘티 · 곡 · 송폼 편집 (코멘트는 누구나) */
    contiEdit: PolicyLevel;
    /** 예배 시작 · 마치기 · 곡/섹션/BPM 진행 */
    sessionRun: PolicyLevel;
    /** 예배 중 '전체' 큐 보내기 (역할 큐는 누구나) */
    cueAll: PolicyLevel;
    /** 연습 · 예배 일정 만들기 · 배치 · 로테이션 (참석 응답 · 대체 지원은 누구나) */
    planningManage: PolicyLevel;
    /** 팀 공지 올리기 (공지 확인은 누구나) */
    announce: PolicyLevel;
}

export type Capability = keyof TeamPolicy | 'teamManage';

export const DEFAULT_POLICY: TeamPolicy = { contiEdit: 'leaders', sessionRun: 'leaders', cueAll: 'everyone', planningManage: 'leaders', announce: 'leaders' };

export const POLICY_LEVELS: readonly PolicyLevel[] = ['admins', 'leaders', 'everyone'];

export const POLICY_LEVEL_LABEL: Record<PolicyLevel, string> = {
    admins: '관리자만',
    leaders: '관리자 · 인도자',
    everyone: '모든 팀원',
};

export const POLICY_ITEMS: readonly { key: keyof TeamPolicy; label: string; description: string }[] = [
    { key: 'contiEdit', label: '콘티 · 곡 편집', description: '곡 순서 · Key · BPM · 송폼을 바꿉니다. 코멘트는 누구나 남길 수 있어요.' },
    { key: 'sessionRun', label: '예배 진행', description: '예배를 시작하고 곡 · 섹션 · BPM 을 넘깁니다. 나머지는 따라갑니다.' },
    { key: 'cueAll', label: '전체 큐 보내기', description: '예배 중 모두에게 가는 큐(한 번 더 · 엔딩 컷 …)를 보냅니다. 음향에게 가는 큐는 누구나 보내요.' },
    { key: 'planningManage', label: '일정 · 배치 관리', description: '연습 · 예배 일정을 만들고 사람을 배치 · 로테이션합니다. 참석 응답과 대체 지원은 누구나 해요.' },
    { key: 'announce', label: '팀 공지 쓰기', description: '팀 공지를 올리고 확인을 받습니다. 공지 확인은 누구나 해요.' },
];

export function parsePolicy(value: unknown): TeamPolicy {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const level = (key: keyof TeamPolicy): PolicyLevel => (POLICY_LEVELS as readonly unknown[]).includes(source[key]) ? source[key] as PolicyLevel : DEFAULT_POLICY[key];
    return { contiEdit: level('contiEdit'), sessionRun: level('sessionRun'), cueAll: level('cueAll'), planningManage: level('planningManage'), announce: level('announce') };
}

export function isAdmin(member: Pick<TeamMember, 'permission'> | null | undefined): boolean {
    return member?.permission === 'owner';
}

export function can(member: Pick<TeamMember, 'permission' | 'role'> | null | undefined, policy: TeamPolicy, capability: Capability): boolean {
    if (!member) return false;
    if (isAdmin(member)) return true;
    if (capability === 'teamManage') return false;
    const level = policy[capability];
    return level === 'everyone' || (level === 'leaders' && member.role === 'leader');
}

/**
 * 일정 · 결석 소식을 챙겨 받을 사람의 기준 — '모든 팀원' 이 일정을 고칠 수 있어도 소식은 관리자 · 인도자에게만 갑니다(모두에게 가면 소음).
 */
export function receivesManagerNotices(member: Pick<TeamMember, 'permission' | 'role'>, policy: TeamPolicy): boolean {
    return can(member, { ...policy, planningManage: policy.planningManage === 'everyone' ? 'leaders' : policy.planningManage }, 'planningManage');
}

/** 화면에 보여 줄 내 권한 요약 */
export function capabilitySummary(member: Pick<TeamMember, 'permission' | 'role'> | null | undefined, policy: TeamPolicy) {
    return POLICY_ITEMS.map((item) => ({ ...item, allowed: can(member, policy, item.key) }));
}
