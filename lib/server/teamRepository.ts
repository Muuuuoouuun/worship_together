import Database from 'better-sqlite3';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '../planning';
import { DEFAULT_POLICY, parsePolicy, type TeamPolicy } from '../permissions';
import type { PlanningCommand, PlanningNotification, PlanningState } from '../../types/planning';
import type { InvitationPreview, OnlineTeam, TeamIdentity, TeamMember, UserProfile, WorshipRole } from '../../types/team';

const roles = new Set(['leader', 'vocal', 'keyboard', 'guitar', 'bass', 'drums', 'sound', 'media', 'member']);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
type TeamRow = { id: string; name: string; owner_id: string; created_at: string };
type InviteRow = { team_id: string; team_name: string; expires_at: string; revoked: number };
/** 사람이 옮겨 적기 쉬운 초대 코드 (헷갈리는 0 · O · 1 · I 제외) */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
function newInviteCode(): string {
    const bytes = randomBytes(8);
    return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

/** Server-owned SQLite storage. Use a persistent volume when deploying this web prototype. */
export class TeamRepository {
    private db: Database.Database;
    constructor(filename: string) {
        if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
        this.db = new Database(filename);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('busy_timeout = 5000');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS online_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS online_members (team_id TEXT NOT NULL REFERENCES online_teams(id) ON DELETE CASCADE, user_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', permission TEXT NOT NULL CHECK(permission IN ('owner','member')), PRIMARY KEY(team_id, user_id));
            CREATE TABLE IF NOT EXISTS online_invites (token_hash TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES online_teams(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
            CREATE INDEX IF NOT EXISTS online_members_user ON online_members(user_id);
            CREATE INDEX IF NOT EXISTS online_invites_team ON online_invites(team_id);
            CREATE TABLE IF NOT EXISTS online_planning (team_id TEXT PRIMARY KEY REFERENCES online_teams(id) ON DELETE CASCADE, state_json TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, onboarded_at TEXT);
            CREATE TABLE IF NOT EXISTS online_team_policy (team_id TEXT PRIMARY KEY REFERENCES online_teams(id) ON DELETE CASCADE, policy_json TEXT NOT NULL);
        `);
        const inviteColumns = this.db.prepare('PRAGMA table_info(online_invites)').all() as { name: string }[];
        if (!inviteColumns.some((column) => column.name === 'code')) this.db.exec('ALTER TABLE online_invites ADD COLUMN code TEXT');
        this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS online_invites_code ON online_invites(code) WHERE code IS NOT NULL');
    }
    close() { this.db.close(); }
    /** 같은 파일을 쓰는 다른 저장소(팀 자료 · 예배 세션 · 팀 소식)가 함께 씁니다. */
    get database() { return this.db; }

    /* ───── 사용자 ───── */

    /** 로그인할 때마다 부릅니다. 처음이면 만들고, 이미 있으면 직접 바꾼 이름을 지킵니다. */
    ensureUser(user: TeamIdentity): UserProfile {
        this.identity(user);
        const now = new Date().toISOString();
        this.db.prepare('INSERT INTO users(id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(user.id, user.name.trim().slice(0, 40), now, now);
        return this.profile(user.id)!;
    }
    profile(userId: string): UserProfile | null {
        const row = this.db.prepare('SELECT id, name, created_at AS createdAt, onboarded_at AS onboardedAt FROM users WHERE id = ?').get(userId) as UserProfile | undefined;
        return row ?? null;
    }
    /** 이름을 바꾸면 내가 들어간 모든 팀의 명단 이름도 함께 바뀝니다. */
    updateProfile(userId: string, name: string): UserProfile {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 40) throw new Error('이름은 1~40자로 입력해주세요.');
        return this.db.transaction(() => {
            const result = this.db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(trimmed, new Date().toISOString(), userId);
            if (result.changes !== 1) throw new Error('로그인 정보를 찾지 못했습니다. 다시 로그인해주세요.');
            this.db.prepare('UPDATE online_members SET name = ? WHERE user_id = ?').run(trimmed, userId);
            return this.profile(userId)!;
        })();
    }
    markOnboarded(userId: string) {
        this.db.prepare('UPDATE users SET onboarded_at = coalesce(onboarded_at, ?) WHERE id = ?').run(new Date().toISOString(), userId);
    }

    /* ───── 권한 ───── */

    /** 팀원이 아니면 null */
    membership(teamId: string, userId: string): TeamMember | null {
        const row = this.db.prepare('SELECT user_id AS userId, name, role, permission FROM online_members WHERE team_id = ? AND user_id = ?').get(teamId, userId) as TeamMember | undefined;
        return row ?? null;
    }
    policy(teamId: string): TeamPolicy {
        const row = this.db.prepare('SELECT policy_json FROM online_team_policy WHERE team_id = ?').get(teamId) as { policy_json: string } | undefined;
        if (!row) return DEFAULT_POLICY;
        try { return parsePolicy(JSON.parse(row.policy_json)); } catch { return DEFAULT_POLICY; }
    }
    setPolicy(teamId: string, userId: string, value: unknown): TeamPolicy {
        this.owner(teamId, userId);
        const policy = parsePolicy(value);
        this.db.prepare('INSERT INTO online_team_policy(team_id, policy_json) VALUES (?, ?) ON CONFLICT(team_id) DO UPDATE SET policy_json = excluded.policy_json').run(teamId, JSON.stringify(policy));
        return policy;
    }
    private planningMembers(teamId: string, userId: string): TeamMember[] {
        this.member(teamId, userId);
        return this.db.prepare('SELECT user_id AS userId, name, role, permission FROM online_members WHERE team_id = ?').all(teamId) as TeamMember[];
    }
    private readPlanning(teamId: string): PlanningState {
        const row = this.db.prepare('SELECT state_json FROM online_planning WHERE team_id = ?').get(teamId) as { state_json: string } | undefined;
        return parsePlanningState(row ? JSON.parse(row.state_json) : null);
    }
    planning(teamId: string, userId: string): PlanningState {
        const members = this.planningMembers(teamId, userId);
        return planningForViewer(this.readPlanning(teamId), members, userId, this.policy(teamId));
    }
    updatePlanning(teamId: string, userId: string, command: PlanningCommand | unknown): PlanningState {
        return this.applyPlanning(teamId, userId, command).state;
    }
    /** 저장하고, 이번 명령으로 새로 생긴 알림도 돌려줍니다 — 받는 사람 화면에 바로 띄우도록 */
    applyPlanning(teamId: string, userId: string, command: PlanningCommand | unknown): { state: PlanningState; created: PlanningNotification[] } {
        return this.db.transaction(() => {
            const members = this.planningMembers(teamId, userId);
            const previous = this.readPlanning(teamId);
            const policy = this.policy(teamId);
            const state = applyPlanningCommand(previous, members, userId, command, policy);
            this.db.prepare('INSERT INTO online_planning(team_id, state_json) VALUES (?, ?) ON CONFLICT(team_id) DO UPDATE SET state_json = excluded.state_json').run(teamId, JSON.stringify(state));
            const before = new Set(previous.notifications.map((item) => item.id));
            return { state: planningForViewer(state, members, userId, policy), created: state.notifications.filter((item) => !before.has(item.id)) };
        })();
    }
    /** 서버 안에서 쓰는 일정 상태와 명단 (권한 검사 없음 — 저장 흐름에서 알림을 만들 때) */
    planningSnapshot(teamId: string): { state: PlanningState; members: TeamMember[] } {
        const members = this.db.prepare('SELECT user_id AS userId, name, role, permission FROM online_members WHERE team_id = ?').all(teamId) as TeamMember[];
        return { state: this.readPlanning(teamId), members };
    }
    /** 일정 명령이 아닌 곳(콘티 저장 등)에서 생긴 알림을 알림 목록에 더합니다. */
    addNotices(teamId: string, items: Array<Pick<PlanningNotification, 'title' | 'body' | 'target' | 'entityId' | 'recipientIds'> & { urgent?: boolean }>): PlanningNotification[] {
        if (!items.length) return [];
        return this.db.transaction(() => {
            const state = this.readPlanning(teamId);
            const now = new Date().toISOString();
            const created = items.map((item): PlanningNotification => ({ id: randomUUID(), title: item.title, body: item.body, urgent: Boolean(item.urgent), target: item.target, entityId: item.entityId, recipientIds: [...new Set(item.recipientIds)], readBy: [], createdAt: now }));
            state.notifications = [...created, ...state.notifications].slice(0, 500);
            this.db.prepare('INSERT INTO online_planning(team_id, state_json) VALUES (?, ?) ON CONFLICT(team_id) DO UPDATE SET state_json = excluded.state_json').run(teamId, JSON.stringify(state));
            return created;
        })();
    }
    private identity(user: TeamIdentity) {
        if (!user.id || user.id.length > 200 || !user.name.trim()) throw new Error('로그인이 필요합니다.');
    }
    private member(teamId: string, userId: string) {
        const member = this.db.prepare('SELECT permission FROM online_members WHERE team_id = ? AND user_id = ?').get(teamId, userId) as { permission: string } | undefined;
        if (!member) throw new Error('이 팀에 접근할 수 없습니다.');
        return member;
    }
    private owner(teamId: string, userId: string) {
        if (this.member(teamId, userId).permission !== 'owner') throw new Error('팀을 만든 관리자만 변경할 수 있습니다.');
    }
    private load(row: TeamRow): OnlineTeam {
        const members = this.db.prepare('SELECT user_id AS userId, name, role, permission FROM online_members WHERE team_id = ? ORDER BY permission DESC, name').all(row.id) as TeamMember[];
        return { id: row.id, name: row.name, ownerId: row.owner_id, createdAt: row.created_at, members };
    }
    list(userId: string): OnlineTeam[] {
        const rows = this.db.prepare('SELECT t.* FROM online_teams t JOIN online_members m ON m.team_id = t.id WHERE m.user_id = ? ORDER BY t.created_at DESC').all(userId) as TeamRow[];
        return rows.map(row => this.load(row));
    }
    create(name: string, user: TeamIdentity): OnlineTeam {
        this.identity(user);
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 40) throw new Error('팀 이름은 1~40자로 입력해주세요.');
        return this.db.transaction(() => {
            const count = this.db.prepare('SELECT count(*) AS count FROM online_teams WHERE owner_id = ?').get(user.id) as { count: number };
            if (count.count >= 30) throw new Error('한 계정에서 최대 30개 팀을 만들 수 있습니다.');
            const row: TeamRow = { id: randomUUID(), name: trimmed, owner_id: user.id, created_at: new Date().toISOString() };
            this.db.prepare('INSERT INTO online_teams(id, name, owner_id, created_at) VALUES (?, ?, ?, ?)').run(row.id, row.name, row.owner_id, row.created_at);
            this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(row.id, user.id, (this.profile(user.id)?.name ?? user.name).trim().slice(0, 40), 'leader', 'owner');
            return this.load(row);
        })();
    }
    createInvite(teamId: string, userId: string): { token: string; code: string; expiresAt: string } {
        return this.db.transaction(() => {
            this.owner(teamId, userId);
            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
            this.db.prepare('DELETE FROM online_invites WHERE team_id = ?').run(teamId);
            let code = newInviteCode();
            while (this.db.prepare('SELECT 1 FROM online_invites WHERE code = ?').get(code)) code = newInviteCode();
            this.db.prepare('INSERT INTO online_invites(token_hash, team_id, expires_at, code) VALUES (?, ?, ?, ?)').run(tokenHash(token), teamId, expiresAt, code);
            return { token, code, expiresAt };
        })();
    }
    /** 관리자가 다시 보여 줄 수 있게, 아직 유효한 초대 코드 (링크 토큰은 저장하지 않으므로 코드만) */
    activeInviteCode(teamId: string, userId: string): { code: string; expiresAt: string } | null {
        this.owner(teamId, userId);
        const row = this.db.prepare('SELECT code, expires_at, revoked FROM online_invites WHERE team_id = ? AND code IS NOT NULL').get(teamId) as { code: string; expires_at: string; revoked: number } | undefined;
        return row && !row.revoked && Date.parse(row.expires_at) > Date.now() ? { code: row.code, expiresAt: row.expires_at } : null;
    }
    revokeInvites(teamId: string, userId: string) {
        this.owner(teamId, userId);
        this.db.prepare('UPDATE online_invites SET revoked = 1 WHERE team_id = ?').run(teamId);
    }
    /** 초대 링크 토큰(64자) 또는 초대 코드(8자)로 초대를 찾습니다. */
    preview(tokenOrCode: string): InvitationPreview | null {
        if (typeof tokenOrCode !== 'string') return null;
        const select = 'SELECT i.team_id, i.expires_at, i.revoked, t.name AS team_name FROM online_invites i JOIN online_teams t ON t.id = i.team_id';
        let invite: InviteRow | undefined;
        if (/^[a-f0-9]{64}$/.test(tokenOrCode)) invite = this.db.prepare(`${select} WHERE i.token_hash = ?`).get(tokenHash(tokenOrCode)) as InviteRow | undefined;
        else {
            const code = normalizeCode(tokenOrCode);
            if (code.length !== 8) return null;
            invite = this.db.prepare(`${select} WHERE i.code = ?`).get(code) as InviteRow | undefined;
        }
        if (!invite || invite.revoked || Date.parse(invite.expires_at) <= Date.now()) return null;
        const claimable = this.db.prepare("SELECT user_id AS userId, name, role FROM online_members WHERE team_id = ? AND user_id LIKE 'direct-%' ORDER BY name").all(invite.team_id) as { userId: string; name: string; role: WorshipRole }[];
        return { teamId: invite.team_id, teamName: invite.team_name, expiresAt: invite.expires_at, claimable };
    }
    /**
     * 초대로 팀에 들어갑니다. claimMemberId 를 주면 관리자가 이름만 먼저 올려 둔 명단 자리(direct-…)를 내 계정으로 잇습니다 —
     * 역할과 일정 배정이 그대로 내 것이 됩니다.
     */
    join(tokenOrCode: string, user: TeamIdentity, claimMemberId?: string): string {
        this.identity(user);
        return this.db.transaction(() => {
            const invite = this.preview(tokenOrCode);
            if (!invite) throw new Error('초대가 만료되었거나 취소되었습니다. 새 링크를 요청해주세요.');
            if (this.db.prepare('SELECT 1 FROM online_members WHERE team_id = ? AND user_id = ?').get(invite.teamId, user.id)) return invite.teamId;
            const name = (this.profile(user.id)?.name ?? user.name).trim().slice(0, 40);
            if (claimMemberId) {
                if (!invite.claimable.some((member) => member.userId === claimMemberId)) throw new Error('고른 명단 자리를 찾지 못했습니다. 다시 골라주세요.');
                this.db.prepare('UPDATE online_members SET user_id = ?, name = ? WHERE team_id = ? AND user_id = ?').run(user.id, name, invite.teamId, claimMemberId);
                const planning = this.db.prepare('SELECT state_json FROM online_planning WHERE team_id = ?').get(invite.teamId) as { state_json: string } | undefined;
                // direct-… id 는 uuid 라 다른 값과 겹치지 않으므로 문자열로 바꿔도 안전합니다.
                if (planning) this.db.prepare('UPDATE online_planning SET state_json = ? WHERE team_id = ?').run(planning.state_json.split(JSON.stringify(claimMemberId)).join(JSON.stringify(user.id)), invite.teamId);
                return invite.teamId;
            }
            const count = this.db.prepare('SELECT count(*) AS count FROM online_members WHERE team_id = ?').get(invite.teamId) as { count: number };
            if (count.count >= 100) throw new Error('이 팀의 참여 인원이 가득 찼습니다.');
            this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(invite.teamId, user.id, name, 'member', 'member');
            return invite.teamId;
        })();
    }
    assignRole(teamId: string, userId: string, memberId: string, role: WorshipRole) {
        this.owner(teamId, userId);
        if (!roles.has(role)) throw new Error('담당 역할을 확인해주세요.');
        const result = this.db.prepare('UPDATE online_members SET role = ? WHERE team_id = ? AND user_id = ?').run(role, teamId, memberId);
        if (result.changes !== 1) throw new Error('팀원을 찾지 못했습니다.');
    }
    addMemberDirect(teamId: string, userId: string, name: string, role: WorshipRole): TeamMember {
        this.owner(teamId, userId);
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 40) throw new Error('팀원 이름은 1~40자로 입력해주세요.');
        if (!roles.has(role)) throw new Error('담당 역할을 확인해주세요.');
        return this.db.transaction(() => {
            const count = this.db.prepare('SELECT count(*) AS count FROM online_members WHERE team_id = ?').get(teamId) as { count: number };
            if (count.count >= 100) throw new Error('이 팀의 참여 인원이 가득 찼습니다.');
            const memberId = `direct-${randomUUID()}`;
            this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(teamId, memberId, trimmed, role, 'member');
            return { userId: memberId, name: trimmed, role, permission: 'member' as const };
        })();
    }
    addMembersBatch(teamId: string, userId: string, items: Array<{ name: string; role: WorshipRole }>): TeamMember[] {
        this.owner(teamId, userId);
        if (!items.length) throw new Error('추가할 팀원 명단이 없습니다.');
        return this.db.transaction(() => {
            const count = this.db.prepare('SELECT count(*) AS count FROM online_members WHERE team_id = ?').get(teamId) as { count: number };
            if (count.count + items.length > 100) throw new Error('이 팀의 최대 인원(100명)을 초과합니다.');
            const added: TeamMember[] = [];
            for (const item of items) {
                const trimmed = item.name.trim();
                if (!trimmed) continue;
                const r = roles.has(item.role) ? item.role : 'member';
                const memberId = `direct-${randomUUID()}`;
                this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(teamId, memberId, trimmed.slice(0, 40), r, 'member');
                added.push({ userId: memberId, name: trimmed.slice(0, 40), role: r, permission: 'member' });
            }
            return added;
        })();
    }
    private creator(teamId: string): string | null {
        return (this.db.prepare('SELECT owner_id FROM online_teams WHERE id = ?').get(teamId) as { owner_id: string } | undefined)?.owner_id ?? null;
    }
    setMemberPermission(teamId: string, userId: string, targetUserId: string, permission: 'owner' | 'member'): void {
        this.owner(teamId, userId);
        if (permission !== 'owner' && permission !== 'member') throw new Error('권한을 확인해주세요.');
        if (targetUserId.startsWith('direct-') && permission === 'owner') throw new Error('아직 계정으로 들어오지 않은 팀원은 관리자로 지정할 수 없습니다.');
        if (targetUserId === this.creator(teamId) && userId !== targetUserId && permission === 'member') throw new Error('팀을 만든 사람의 권한은 본인만 바꿀 수 있습니다.');
        if (userId === targetUserId && permission === 'member') {
            const ownerCount = this.db.prepare('SELECT count(*) AS count FROM online_members WHERE team_id = ? AND permission = ?').get(teamId, 'owner') as { count: number };
            if (ownerCount.count <= 1) throw new Error('마지막 관리자는 일반 팀원으로 변경할 수 없습니다.');
        }
        const result = this.db.prepare('UPDATE online_members SET permission = ? WHERE team_id = ? AND user_id = ?').run(permission, teamId, targetUserId);
        if (result.changes !== 1) throw new Error('팀원을 찾지 못했습니다.');
    }
    deleteTeam(teamId: string, userId: string): void {
        this.owner(teamId, userId);
        if (this.creator(teamId) !== userId) throw new Error('팀은 만든 사람만 삭제할 수 있습니다.');
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM online_invites WHERE team_id = ?').run(teamId);
            this.db.prepare('DELETE FROM online_members WHERE team_id = ?').run(teamId);
            this.db.prepare('DELETE FROM online_planning WHERE team_id = ?').run(teamId);
            this.db.prepare('DELETE FROM online_teams WHERE id = ?').run(teamId);
        })();
    }
    removeMember(teamId: string, userId: string, targetUserId: string): void {
        this.owner(teamId, userId);
        if (userId === targetUserId) throw new Error('팀 관리자는 직접 탈퇴하거나 팀을 삭제해야 합니다.');
        if (targetUserId === this.creator(teamId)) throw new Error('팀을 만든 사람은 내보낼 수 없습니다.');
        const result = this.db.prepare('DELETE FROM online_members WHERE team_id = ? AND user_id = ?').run(teamId, targetUserId);
        if (result.changes !== 1) throw new Error('팀원을 찾지 못했습니다.');
    }
    leaveTeam(teamId: string, userId: string): void {
        const member = this.db.prepare('SELECT permission FROM online_members WHERE team_id = ? AND user_id = ?').get(teamId, userId) as { permission: string } | undefined;
        if (!member) throw new Error('이 팀의 팀원이 아닙니다.');
        this.db.transaction(() => {
            if (member.permission === 'owner') {
                // 다른 관리자가 있으면 나갈 수 있고, 만든 사람이 나가면 다른 관리자에게 팀을 넘깁니다.
                const other = this.db.prepare("SELECT user_id FROM online_members WHERE team_id = ? AND permission = 'owner' AND user_id <> ? ORDER BY name LIMIT 1").get(teamId, userId) as { user_id: string } | undefined;
                if (!other) throw new Error('다른 관리자를 지정한 뒤 나갈 수 있습니다. 혼자라면 팀을 삭제해주세요.');
                if (this.creator(teamId) === userId) this.db.prepare('UPDATE online_teams SET owner_id = ? WHERE id = ?').run(other.user_id, teamId);
            }
            this.db.prepare('DELETE FROM online_members WHERE team_id = ? AND user_id = ?').run(teamId, userId);
        })();
    }
}
