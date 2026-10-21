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
}

export type Capability = keyof TeamPolicy | 'teamManage';

export const DEFAULT_POLICY: TeamPolicy = { contiEdit: 'leaders', sessionRun: 'leaders', cueAll: 'everyone' };

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
];

export function parsePolicy(value: unknown): TeamPolicy {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const level = (key: keyof TeamPolicy): PolicyLevel => (POLICY_LEVELS as readonly unknown[]).includes(source[key]) ? source[key] as PolicyLevel : DEFAULT_POLICY[key];
    return { contiEdit: level('contiEdit'), sessionRun: level('sessionRun'), cueAll: level('cueAll') };
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

/** 화면에 보여 줄 내 권한 요약 */
export function capabilitySummary(member: Pick<TeamMember, 'permission' | 'role'> | null | undefined, policy: TeamPolicy) {
    return POLICY_ITEMS.map((item) => ({ ...item, allowed: can(member, policy, item.key) }));
}
