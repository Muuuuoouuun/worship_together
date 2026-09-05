import Database from 'better-sqlite3';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { applyPlanningCommand, parsePlanningState, planningForViewer } from '../planning';
import type { PlanningCommand, PlanningState } from '../../types/planning';
import type { InvitationPreview, OnlineTeam, TeamIdentity, TeamMember, WorshipRole } from '../../types/team';

const roles = new Set(['leader', 'vocal', 'keyboard', 'guitar', 'bass', 'drums', 'sound', 'media', 'member']);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
type TeamRow = { id: string; name: string; owner_id: string; created_at: string };
type InviteRow = { team_id: string; team_name: string; expires_at: string; revoked: number };

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
        `);
    }
    close() { this.db.close(); }
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
        return planningForViewer(this.readPlanning(teamId), members, userId);
    }
    updatePlanning(teamId: string, userId: string, command: PlanningCommand | unknown): PlanningState {
        return this.db.transaction(() => {
            const members = this.planningMembers(teamId, userId);
            const state = applyPlanningCommand(this.readPlanning(teamId), members, userId, command);
            this.db.prepare('INSERT INTO online_planning(team_id, state_json) VALUES (?, ?) ON CONFLICT(team_id) DO UPDATE SET state_json = excluded.state_json').run(teamId, JSON.stringify(state));
            return planningForViewer(state, members, userId);
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
            this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(row.id, user.id, user.name.trim().slice(0, 40), 'leader', 'owner');
            return this.load(row);
        })();
    }
    createInvite(teamId: string, userId: string): { token: string; expiresAt: string } {
        return this.db.transaction(() => {
            this.owner(teamId, userId);
            const token = randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
            this.db.prepare('DELETE FROM online_invites WHERE team_id = ?').run(teamId);
            this.db.prepare('INSERT INTO online_invites(token_hash, team_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), teamId, expiresAt);
            return { token, expiresAt };
        })();
    }
    revokeInvites(teamId: string, userId: string) {
        this.owner(teamId, userId);
        this.db.prepare('UPDATE online_invites SET revoked = 1 WHERE team_id = ?').run(teamId);
    }
    preview(token: string): InvitationPreview | null {
        if (!/^[a-f0-9]{64}$/.test(token)) return null;
        const invite = this.db.prepare('SELECT i.team_id, i.expires_at, i.revoked, t.name AS team_name FROM online_invites i JOIN online_teams t ON t.id = i.team_id WHERE i.token_hash = ?').get(tokenHash(token)) as InviteRow | undefined;
        return invite && !invite.revoked && Date.parse(invite.expires_at) > Date.now() ? { teamId: invite.team_id, teamName: invite.team_name, expiresAt: invite.expires_at } : null;
    }
    join(token: string, user: TeamIdentity): string {
        this.identity(user);
        return this.db.transaction(() => {
            const invite = this.preview(token);
            if (!invite) throw new Error('초대가 만료되었거나 취소되었습니다. 새 링크를 요청해주세요.');
            if (this.db.prepare('SELECT 1 FROM online_members WHERE team_id = ? AND user_id = ?').get(invite.teamId, user.id)) return invite.teamId;
            const count = this.db.prepare('SELECT count(*) AS count FROM online_members WHERE team_id = ?').get(invite.teamId) as { count: number };
            if (count.count >= 100) throw new Error('이 팀의 참여 인원이 가득 찼습니다.');
            this.db.prepare('INSERT INTO online_members(team_id, user_id, name, role, permission) VALUES (?, ?, ?, ?, ?)').run(invite.teamId, user.id, user.name.trim().slice(0, 40), 'member', 'member');
            return invite.teamId;
        })();
    }
    assignRole(teamId: string, userId: string, memberId: string, role: WorshipRole) {
        this.owner(teamId, userId);
        if (!roles.has(role)) throw new Error('담당 역할을 확인해주세요.');
        const result = this.db.prepare('UPDATE online_members SET role = ? WHERE team_id = ? AND user_id = ?').run(role, teamId, memberId);
        if (result.changes !== 1) throw new Error('팀원을 찾지 못했습니다.');
    }
}
