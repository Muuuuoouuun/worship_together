import * as z from 'zod';

/** Local rehearsal of team management; never use this store as an authorization source. */
export const TEAM_STORAGE_KEY = 'worship-together:teams:v1';
export const TEAM_STORAGE_EVENT = 'worship-together:teams-changed';
const UNAVAILABLE = '__team_storage_unavailable__';

export const teamRoles = {
    leader: '인도자',
    vocal: '보컬',
    keyboard: '건반',
    guitar: '기타',
    bass: '베이스',
    drums: '드럼',
    sound: '음향',
    media: '영상·자막',
    member: '미정',
} as const;

const roleSchema = z.enum(['leader', 'vocal', 'keyboard', 'guitar', 'bass', 'drums', 'sound', 'media', 'member']);
const nameSchema = z.string().trim().min(1).max(40);
const teamSchema = z.object({
    id: z.string().min(1),
    name: nameSchema,
    inviteCode: z.string().regex(/^[A-F0-9]{8}$/),
    snapshotImportedAt: z.iso.datetime().optional(),
    members: z.array(z.object({
        id: z.string().min(1),
        name: nameSchema,
        role: roleSchema,
    })).min(1).max(100),
});
const stateSchema = z.object({
    version: z.literal(1),
    activeTeamId: z.string().nullable(),
    teams: z.array(teamSchema).max(100),
});

// Portable roster snapshots deliberately contain no identity or invitation credentials.
export const TEAM_BUNDLE_MAX_BYTES = 128 * 1024;
const rosterSchema = z.object({
    name: nameSchema,
    members: z.array(z.object({ name: nameSchema, role: roleSchema }).strict()).min(1).max(100),
}).strict().refine((team) => team.members.some((member) => member.role === 'leader'), '인도자가 필요합니다.')
    .refine((team) => new Set(team.members.map((member) => member.name.toLowerCase())).size === team.members.length, '팀원 이름이 중복됩니다.');
const bundleSchema = z.object({
    format: z.literal('worship-together/team-roster'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    team: rosterSchema,
}).strict();

export type TeamRosterBundle = z.infer<typeof bundleSchema>;

export type TeamRole = z.infer<typeof roleSchema>;
export type PrototypeTeam = z.infer<typeof teamSchema>;
export type TeamPrototypeState = z.infer<typeof stateSchema>;
const emptyState: TeamPrototypeState = { version: 1, activeTeamId: null, teams: [] };

export function getTeamSnapshot(): string | null {
    try {
        return window.localStorage.getItem(TEAM_STORAGE_KEY);
    } catch {
        return UNAVAILABLE;
    }
}

export function getTeamServerSnapshot(): null { return null; }

export function subscribeToTeams(callback: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key === TEAM_STORAGE_KEY || event.key === null) callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(TEAM_STORAGE_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(TEAM_STORAGE_EVENT, callback);
    };
}

export function parseTeamSnapshot(raw: string | null): TeamPrototypeState {
    if (raw === null) return emptyState;
    if (raw === UNAVAILABLE) throw new Error('브라우저 저장 공간을 사용할 수 없습니다. 저장 허용 설정을 확인해주세요.');
    try {
        return stateSchema.parse(JSON.parse(raw));
    } catch {
        throw new Error('저장된 팀 데이터를 읽을 수 없습니다. 기존 데이터를 보존하기 위해 변경을 중단했습니다.');
    }
}

function updateTeams(update: (state: TeamPrototypeState) => TeamPrototypeState): void {
    // Read at action time so another tab's latest completed edit is retained.
    const next = update(parseTeamSnapshot(getTeamSnapshot()));
    const checked = stateSchema.safeParse(next);
    if (!checked.success) throw new Error('팀은 최대 100개, 팀원은 팀당 100명까지 저장할 수 있습니다.');
    try {
        window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(checked.data));
    } catch {
        throw new Error('저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인해주세요.');
    }
    window.dispatchEvent(new Event(TEAM_STORAGE_EVENT));
}

function checkedName(value: string): string {
    const result = nameSchema.safeParse(value);
    if (!result.success) throw new Error('이름은 공백을 제외하고 1~40자로 입력해주세요.');
    return result.data;
}

function newId(): string {
    // getRandomValues also works when previewing over a tablet's local HTTP network.
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newInviteCode(teams: PrototypeTeam[]): string {
    let code = newId().slice(0, 8).toUpperCase();
    while (teams.some((team) => team.inviteCode === code)) {
        code = newId().slice(0, 8).toUpperCase();
    }
    return code;
}

export function exportTeamRoster(teamId: string): string {
    const team = parseTeamSnapshot(getTeamSnapshot()).teams.find((item) => item.id === teamId);
    if (!team) throw new Error('내보낼 팀을 찾을 수 없습니다.');
    const bundle = bundleSchema.safeParse({
        format: 'worship-together/team-roster',
        version: 1,
        exportedAt: new Date().toISOString(),
        team: { name: team.name, members: team.members.map(({ name, role }) => ({ name, role })) },
    });
    if (!bundle.success) throw new Error('내보낼 명단을 확인해주세요. 팀원 이름은 중복 없이, 인도자는 한 명 이상 필요합니다.');
    return JSON.stringify(bundle.data, null, 2);
}

export function parseTeamRosterBundle(text: string): TeamRosterBundle {
    if (text.length > TEAM_BUNDLE_MAX_BYTES || new TextEncoder().encode(text).length > TEAM_BUNDLE_MAX_BYTES) {
        throw new Error('명단 파일은 128KB 이하만 가져올 수 있습니다.');
    }
    let value: unknown;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('JSON 파일을 읽을 수 없습니다. 내보낸 팀 명단 파일을 선택해주세요.'); }
    const result = bundleSchema.safeParse(value);
    if (!result.success) throw new Error('지원하는 팀 명단 파일이 아닙니다. 버전 1 형식, 팀원 1~100명, 중복 없는 이름, 올바른 역할과 인도자가 필요합니다.');
    return result.data;
}

export function importTeamRoster(bundle: TeamRosterBundle): void {
    // Validate again at the persistence boundary, regardless of the caller's TS types.
    const result = bundleSchema.safeParse(bundle);
    if (!result.success) throw new Error('명단 형식이 올바르지 않아 가져오지 않았습니다.');
    updateTeams((state) => {
        const team: PrototypeTeam = {
            id: newId(),
            name: result.data.team.name,
            inviteCode: newInviteCode(state.teams),
            snapshotImportedAt: new Date().toISOString(),
            members: result.data.team.members.map((member) => ({ ...member, id: newId() })),
        };
        return { ...state, activeTeamId: team.id, teams: [...state.teams, team] };
    });
}

export function createPrototypeTeam(teamName: string, leaderName: string): void {
    const name = checkedName(teamName);
    const leader = checkedName(leaderName);
    updateTeams((state) => {
        const team: PrototypeTeam = {
            id: newId(), name, inviteCode: newInviteCode(state.teams),
            members: [{ id: newId(), name: leader, role: 'leader' }],
        };
        return { ...state, activeTeamId: team.id, teams: [...state.teams, team] };
    });
}

export function normalizeTeamInvite(value: string): string {
    let code = value.trim();
    if (/^https?:\/\//i.test(code)) {
        try { code = new URL(code).searchParams.get('invite') ?? ''; }
        catch { throw new Error('초대 링크를 확인해주세요.'); }
    }
    code = code.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(code)) throw new Error('8자리 초대 코드 또는 복사한 초대 링크를 입력해주세요.');
    return code;
}

export function joinPrototypeTeam(invite: string, memberName: string): void {
    const code = normalizeTeamInvite(invite);
    const name = checkedName(memberName);
    updateTeams((state) => {
        const team = state.teams.find((item) => item.inviteCode === code);
        if (!team) throw new Error('이 브라우저에 해당 팀이 없습니다. 팀을 만든 같은 기기·브라우저·사이트 주소에서 참여를 체험해주세요.');
        if (team.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('이미 등록된 이름입니다. 동명이인은 구분할 이름을 입력해주세요.');
        }
        return {
            ...state, activeTeamId: team.id,
            teams: state.teams.map((item) => item.id === team.id
                ? { ...item, members: [...item.members, { id: newId(), name, role: 'member' as const }] }
                : item),
        };
    });
}

export function selectPrototypeTeam(teamId: string): void {
    updateTeams((state) => {
        if (!state.teams.some((team) => team.id === teamId)) throw new Error('팀을 찾을 수 없습니다.');
        return { ...state, activeTeamId: teamId };
    });
}

export function assignPrototypeRole(teamId: string, memberId: string, role: TeamRole): void {
    if (!roleSchema.safeParse(role).success) throw new Error('선택한 역할을 확인해주세요.');
    updateTeams((state) => {
        const team = state.teams.find((item) => item.id === teamId);
        const member = team?.members.find((item) => item.id === memberId);
        if (!team || !member) throw new Error('팀원을 찾을 수 없습니다.');
        if (member.role === 'leader' && role !== 'leader' && team.members.filter((item) => item.role === 'leader').length === 1) {
            throw new Error('다른 팀원을 먼저 인도자로 지정해주세요. 팀에는 인도자가 한 명 이상 필요합니다.');
        }
        return {
            ...state,
            teams: state.teams.map((item) => item.id === teamId
                ? { ...item, members: item.members.map((person) => person.id === memberId ? { ...person, role } : person) }
                : item),
        };
    });
}
