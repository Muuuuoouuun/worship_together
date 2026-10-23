import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { can, type TeamPolicy } from '../permissions';
import { CUE_TARGET_LABEL, cueById, cueGroupOf, type CueTarget, type LiveSong } from '../../components/live/model';
import type { TeamIdentity, TeamMember } from '../../types/team';
import type { TeamRepository } from './teamRepository';
import type { TeamEvents } from './teamEvents';

/*
 * 예배 세션 (서버). 한 팀에 진행 중인 세션은 하나 — 인도자가 시작하면 팀원 모두가 같은 세션에 들어옵니다.
 * - 입장 · 퇴장: 기기마다 입장 기록을 남기고 15초마다 살아 있음을 알립니다. 45초 동안 소식이 없으면 나간 것으로 봅니다.
 * - 진행(곡 · 섹션 · 쪽 · BPM)과 마치기는 팀 정책의 '예배 진행' 권한이 있는 사람만.
 * - 큐는 받는 묶음(전체 · 인도자 · 찬양팀 · 음향 · 미디어)의 지금 접속한 사람에게 가고, 받은 사람이 '확인' 하면 보낸 사람에게 알립니다.
 */

export interface LiveSnapshot {
    setlistId: string | null;
    title: string;
    dateLabel: string | null;
    theme: string | null;
    songs: LiveSong[];
}

export interface LiveState {
    songIndex: number;
    sectionIndex: number;
    page: number;
    bpm: number | null;
    version: number;
    movedBy: string | null;
    movedByName: string | null;
    updatedAt: string;
}

export interface LivePresence {
    userId: string;
    name: string;
    joinedAt: string;
}

export interface LiveCueRecord {
    id: string;
    cueId: string;
    label: string;
    target: CueTarget;
    fromUserId: string;
    fromName: string;
    createdAt: string;
    recipients: string[];
    acks: { userId: string; name: string; at: string }[];
}

export interface LiveSessionSummary {
    id: string;
    teamId: string;
    title: string;
    startedAt: string;
    startedByName: string;
    songCount: number;
    currentSongTitle: string | null;
    present: number;
}

export interface LiveSessionDetail {
    session: {
        id: string;
        teamId: string;
        teamName: string;
        snapshot: LiveSnapshot;
        startedAt: string;
        startedByName: string;
        endedAt: string | null;
        endedByName: string | null;
    };
    state: LiveState;
    presence: LivePresence[];
    cues: LiveCueRecord[];
    members: TeamMember[];
    policy: TeamPolicy;
    me: TeamMember;
}

export type LiveMovePatch = Partial<Pick<LiveState, 'songIndex' | 'sectionIndex' | 'page' | 'bpm'>>;

type SessionRow = {
    id: string; team_id: string; snapshot_json: string; state_json: string; started_by: string; started_by_name: string;
    started_at: string; ended_at: string | null; ended_by_name: string | null; last_activity_at: string;
};
type CueRow = { id: string; session_id: string; cue_id: string; label: string; target: CueTarget; from_user: string; from_name: string; created_at: string; recipients_json: string };

/** 이만큼 소식이 없으면 그 기기는 나간 것으로 봅니다 (화면은 15초마다 알립니다) */
export const PRESENCE_STALE_MS = 45_000;
/** 아무도 없는 채로 이만큼 지나면 세션을 저절로 마칩니다 */
const IDLE_END_MS = 3 * 60 * 60 * 1000;
/** 시작하고 이만큼 지나면 저절로 마칩니다 */
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
const RECENT_CUES = 40;

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
const isBpm = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 300;

/** 시작하는 사람의 기기가 보낸 콘티 사본을 검사합니다. 세션 동안은 이 사본만 씁니다(다른 기기에 곡 자료가 없어도 같은 순서를 봅니다). */
export function sanitizeSnapshot(value: unknown): LiveSnapshot {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const songs = Array.isArray(source.songs) ? source.songs : [];
    if (!songs.length) throw new Error('콘티에 곡이 없습니다. 곡을 추가한 뒤 시작해주세요.');
    if (songs.length > 60) throw new Error('한 번에 60곡까지 진행할 수 있습니다.');
    const seen = new Set<string>();
    return {
        setlistId: text(source.setlistId, 100),
        title: text(source.title, 80) ?? '예배',
        dateLabel: text(source.dateLabel, 40),
        theme: text(source.theme, 80),
        songs: songs.map((raw, index) => {
            const song = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
            let id = text(song.id, 100) ?? `song-${index + 1}`;
            // 같은 곡을 두 번 부르는 콘티도 순서대로 구분합니다.
            while (seen.has(id)) id = `${id}#${index + 1}`;
            seen.add(id);
            const meter = typeof song.meter === 'string' && /^\d{1,2}\/\d{1,2}$/.test(song.meter) ? song.meter : '4/4';
            return {
                id,
                title: text(song.title, 120) ?? `${index + 1}번째 곡`,
                key: text(song.key, 8),
                bpm: isBpm(song.bpm) ? Math.round(song.bpm) : null,
                meter,
                sections: Array.isArray(song.sections) ? song.sections.map((item) => text(item, 40)).filter((item): item is string => Boolean(item)).slice(0, 40) : [],
                note: text(song.note, 300),
                transitionNote: text(song.transitionNote, 120),
                lead: text(song.lead, 40),
            };
        }),
    };
}

function firstState(snapshot: LiveSnapshot, by: TeamIdentity): LiveState {
    const song = snapshot.songs[0];
    return { songIndex: 0, sectionIndex: song.sections.length ? 0 : -1, page: 1, bpm: song.bpm, version: 1, movedBy: by.id, movedByName: by.name, updatedAt: new Date().toISOString() };
}

export class LiveRepository {
    /** 예배를 새로 시작한 뒤 부르는 곳 (앱을 닫은 팀원에게 푸시). 실패해도 시작은 그대로입니다. */
    afterStart: ((session: LiveSessionSummary, starterId: string) => void) | null = null;

    constructor(private db: Database.Database, private teams: TeamRepository, private events: TeamEvents) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS live_sessions (
                id TEXT PRIMARY KEY,
                team_id TEXT NOT NULL REFERENCES online_teams(id) ON DELETE CASCADE,
                snapshot_json TEXT NOT NULL,
                state_json TEXT NOT NULL,
                started_by TEXT NOT NULL,
                started_by_name TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                ended_by_name TEXT,
                last_activity_at TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_one_active ON live_sessions(team_id) WHERE ended_at IS NULL;
            CREATE TABLE IF NOT EXISTS live_presence (
                session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                last_seen INTEGER NOT NULL,
                PRIMARY KEY(session_id, user_id, device_id)
            );
            CREATE TABLE IF NOT EXISTS live_cues (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
                cue_id TEXT NOT NULL,
                label TEXT NOT NULL,
                target TEXT NOT NULL,
                from_user TEXT NOT NULL,
                from_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                recipients_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS live_cues_session ON live_cues(session_id, created_at);
            CREATE TABLE IF NOT EXISTS live_acks (
                cue_id TEXT NOT NULL REFERENCES live_cues(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                at TEXT NOT NULL,
                PRIMARY KEY(cue_id, user_id)
            );
        `);
    }

    /* ───── 읽기 ───── */

    private row(sessionId: string): SessionRow {
        const row = typeof sessionId === 'string' && sessionId.length <= 100
            ? this.db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(sessionId) as SessionRow | undefined
            : undefined;
        if (!row) throw new Error('예배 세션을 찾지 못했습니다.');
        return row;
    }

    private memberOf(teamId: string, userId: string): TeamMember {
        const member = this.teams.membership(teamId, userId);
        if (!member) throw new Error('이 팀에 접근할 수 없습니다.');
        return member;
    }

    private members(teamId: string): TeamMember[] {
        return this.db.prepare('SELECT user_id AS userId, name, role, permission FROM online_members WHERE team_id = ? ORDER BY name').all(teamId) as TeamMember[];
    }

    private presence(sessionId: string, members: TeamMember[]): LivePresence[] {
        const rows = this.db.prepare('SELECT user_id, min(joined_at) AS joined_at FROM live_presence WHERE session_id = ? GROUP BY user_id ORDER BY joined_at').all(sessionId) as { user_id: string; joined_at: string }[];
        return rows.flatMap((row) => {
            const member = members.find((item) => item.userId === row.user_id);
            return member ? [{ userId: row.user_id, name: member.name, joinedAt: row.joined_at }] : [];
        });
    }

    private presentIds(sessionId: string): Set<string> {
        return new Set((this.db.prepare('SELECT DISTINCT user_id FROM live_presence WHERE session_id = ?').all(sessionId) as { user_id: string }[]).map((row) => row.user_id));
    }

    private cueRecord(row: CueRow): LiveCueRecord {
        const acks = this.db.prepare('SELECT user_id AS userId, name, at FROM live_acks WHERE cue_id = ? ORDER BY at').all(row.id) as LiveCueRecord['acks'];
        return { id: row.id, cueId: row.cue_id, label: row.label, target: row.target, fromUserId: row.from_user, fromName: row.from_name, createdAt: row.created_at, recipients: JSON.parse(row.recipients_json) as string[], acks };
    }

    private summary(row: SessionRow): LiveSessionSummary {
        const snapshot = JSON.parse(row.snapshot_json) as LiveSnapshot;
        const state = JSON.parse(row.state_json) as LiveState;
        return {
            id: row.id,
            teamId: row.team_id,
            title: snapshot.title,
            startedAt: row.started_at,
            startedByName: row.started_by_name,
            songCount: snapshot.songs.length,
            currentSongTitle: snapshot.songs[state.songIndex]?.title ?? null,
            present: this.presentIds(row.id).size,
        };
    }

    /** 팀에서 지금 진행 중인 세션 (없으면 null) */
    active(teamId: string, userId: string): LiveSessionSummary | null {
        this.memberOf(teamId, userId);
        this.sweep();
        const row = this.db.prepare('SELECT * FROM live_sessions WHERE team_id = ? AND ended_at IS NULL').get(teamId) as SessionRow | undefined;
        return row ? this.summary(row) : null;
    }

    detail(sessionId: string, userId: string): LiveSessionDetail {
        this.sweep();
        const row = this.row(sessionId);
        const me = this.memberOf(row.team_id, userId);
        const members = this.members(row.team_id);
        const teamName = (this.db.prepare('SELECT name FROM online_teams WHERE id = ?').get(row.team_id) as { name: string }).name;
        const cueRows = this.db.prepare('SELECT * FROM live_cues WHERE session_id = ? ORDER BY created_at DESC LIMIT ?').all(sessionId, RECENT_CUES * 3) as CueRow[];
        const cues = cueRows.map((cue) => this.cueRecord(cue)).filter((cue) => cue.fromUserId === userId || cue.recipients.includes(userId)).slice(0, RECENT_CUES);
        return {
            session: {
                id: row.id,
                teamId: row.team_id,
                teamName,
                snapshot: JSON.parse(row.snapshot_json) as LiveSnapshot,
                startedAt: row.started_at,
                startedByName: row.started_by_name,
                endedAt: row.ended_at,
                endedByName: row.ended_by_name,
            },
            state: JSON.parse(row.state_json) as LiveState,
            presence: this.presence(sessionId, members),
            cues,
            members,
            policy: this.teams.policy(row.team_id),
            me,
        };
    }

    /* ───── 시작 · 마치기 ───── */

    /** 이미 진행 중인 세션이 있으면 새로 만들지 않고 그 세션을 돌려줍니다 (두 사람이 동시에 눌러도 하나). */
    start(teamId: string, user: TeamIdentity, input: unknown): { session: LiveSessionSummary; created: boolean } {
        const member = this.memberOf(teamId, user.id);
        if (!can(member, this.teams.policy(teamId), 'sessionRun')) throw new Error('예배를 시작할 권한이 없습니다. 팀 관리자에게 요청해주세요.');
        this.sweep();
        const existing = this.db.prepare('SELECT * FROM live_sessions WHERE team_id = ? AND ended_at IS NULL').get(teamId) as SessionRow | undefined;
        if (existing) return { session: this.summary(existing), created: false };
        const snapshot = sanitizeSnapshot(input);
        const now = new Date().toISOString();
        const id = randomUUID();
        const by = { id: user.id, name: member.name };
        this.db.prepare('INSERT INTO live_sessions(id, team_id, snapshot_json, state_json, started_by, started_by_name, started_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, teamId, JSON.stringify(snapshot), JSON.stringify(firstState(snapshot, by)), user.id, member.name, now, now);
        const session = this.summary(this.row(id));
        this.events.publish(teamId, 'live.started', session);
        try { this.afterStart?.(session, user.id); } catch (error) { console.error('[live] afterStart', error); }
        return { session, created: true };
    }

    end(sessionId: string, user: TeamIdentity): void {
        const row = this.row(sessionId);
        if (row.ended_at) return;
        const member = this.memberOf(row.team_id, user.id);
        if (!can(member, this.teams.policy(row.team_id), 'sessionRun')) throw new Error('예배를 마칠 권한이 없습니다.');
        this.finish(row, member.name);
    }

    private finish(row: SessionRow, byName: string | null) {
        const now = new Date().toISOString();
        this.db.transaction(() => {
            this.db.prepare('UPDATE live_sessions SET ended_at = ?, ended_by_name = ? WHERE id = ? AND ended_at IS NULL').run(now, byName, row.id);
            this.db.prepare('DELETE FROM live_presence WHERE session_id = ?').run(row.id);
        })();
        this.events.publish(row.team_id, 'live.ended', { sessionId: row.id, endedAt: now, endedByName: byName });
    }

    /* ───── 입장 · 퇴장 ───── */

    private publishPresence(row: SessionRow) {
        this.events.publish(row.team_id, 'live.presence', { sessionId: row.id, presence: this.presence(row.id, this.members(row.team_id)) });
    }

    private requireOpen(row: SessionRow) {
        if (row.ended_at) throw new Error('이미 마친 예배입니다.');
    }

    join(sessionId: string, userId: string, deviceId: string): void {
        const row = this.row(sessionId);
        this.memberOf(row.team_id, userId);
        this.requireOpen(row);
        const device = text(deviceId, 64);
        if (!device) throw new Error('기기 정보를 확인해주세요.');
        const wasPresent = this.presentIds(sessionId).has(userId);
        const now = new Date().toISOString();
        this.db.prepare('INSERT INTO live_presence(session_id, user_id, device_id, joined_at, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, user_id, device_id) DO UPDATE SET last_seen = excluded.last_seen')
            .run(sessionId, userId, device, now, Date.now());
        this.db.prepare('UPDATE live_sessions SET last_activity_at = ? WHERE id = ?').run(now, sessionId);
        if (!wasPresent) this.publishPresence(row);
    }

    /** 살아 있음 알림. 그새 나간 것으로 처리됐으면 다시 들어온 것으로 봅니다. */
    heartbeat(sessionId: string, userId: string, deviceId: string): void {
        const row = this.row(sessionId);
        this.requireOpen(row);
        const result = this.db.prepare('UPDATE live_presence SET last_seen = ? WHERE session_id = ? AND user_id = ? AND device_id = ?').run(Date.now(), sessionId, userId, deviceId);
        if (result.changes === 0) this.join(sessionId, userId, deviceId);
        this.sweep();
    }

    leave(sessionId: string, userId: string, deviceId: string): void {
        const row = this.row(sessionId);
        if (row.ended_at) return;
        this.db.prepare('DELETE FROM live_presence WHERE session_id = ? AND user_id = ? AND device_id = ?').run(sessionId, userId, deviceId);
        if (!this.presentIds(sessionId).has(userId)) this.publishPresence(row);
    }

    /** 소식이 끊긴 기기를 내보내고, 오래 비어 있던 세션은 마칩니다. 요청마다 불러도 가볍습니다. */
    sweep(now = Date.now()): void {
        const stale = this.db.prepare('SELECT DISTINCT session_id FROM live_presence WHERE last_seen < ?').all(now - PRESENCE_STALE_MS) as { session_id: string }[];
        for (const { session_id: sessionId } of stale) {
            const before = this.presentIds(sessionId);
            this.db.prepare('DELETE FROM live_presence WHERE session_id = ? AND last_seen < ?').run(sessionId, now - PRESENCE_STALE_MS);
            const after = this.presentIds(sessionId);
            if (after.size !== before.size) this.publishPresence(this.row(sessionId));
        }
        const open = this.db.prepare('SELECT * FROM live_sessions WHERE ended_at IS NULL').all() as SessionRow[];
        for (const row of open) {
            const idle = now - Date.parse(row.last_activity_at) > IDLE_END_MS && this.presentIds(row.id).size === 0;
            if (idle || now - Date.parse(row.started_at) > MAX_SESSION_MS) this.finish(row, null);
        }
    }

    /* ───── 진행 ───── */

    move(sessionId: string, user: TeamIdentity, patch: LiveMovePatch): LiveState {
        const row = this.row(sessionId);
        this.requireOpen(row);
        const member = this.memberOf(row.team_id, user.id);
        if (!can(member, this.teams.policy(row.team_id), 'sessionRun')) throw new Error('진행 권한이 없습니다. 인도자를 따라가요.');
        return this.db.transaction(() => {
            const current = JSON.parse((this.db.prepare('SELECT state_json FROM live_sessions WHERE id = ?').get(sessionId) as { state_json: string }).state_json) as LiveState;
            const snapshot = JSON.parse(row.snapshot_json) as LiveSnapshot;
            const next = { ...current };
            if (typeof patch.songIndex === 'number' && Number.isInteger(patch.songIndex)) {
                const songIndex = Math.max(0, Math.min(snapshot.songs.length - 1, patch.songIndex));
                if (songIndex !== current.songIndex) {
                    const song = snapshot.songs[songIndex];
                    Object.assign(next, { songIndex, sectionIndex: song.sections.length ? 0 : -1, page: 1, bpm: song.bpm });
                }
            }
            const song = snapshot.songs[next.songIndex];
            if (typeof patch.sectionIndex === 'number' && Number.isInteger(patch.sectionIndex)) {
                next.sectionIndex = song.sections.length ? Math.max(0, Math.min(song.sections.length - 1, patch.sectionIndex)) : -1;
            }
            if (typeof patch.page === 'number' && Number.isInteger(patch.page)) next.page = Math.max(1, Math.min(99, patch.page));
            if (patch.bpm === null || isBpm(patch.bpm)) next.bpm = patch.bpm === null ? null : Math.round(patch.bpm);
            const changed = next.songIndex !== current.songIndex || next.sectionIndex !== current.sectionIndex || next.page !== current.page || next.bpm !== current.bpm;
            if (!changed) return current;
            const now = new Date().toISOString();
            const state: LiveState = { ...next, version: current.version + 1, movedBy: user.id, movedByName: member.name, updatedAt: now };
            this.db.prepare('UPDATE live_sessions SET state_json = ?, last_activity_at = ? WHERE id = ?').run(JSON.stringify(state), now, sessionId);
            this.events.publish(row.team_id, 'live.state', { sessionId, state });
            return state;
        })();
    }

    /* ───── 큐 ───── */

    /** entryId 는 보내는 기기가 정합니다 — 다시 보내기(재시도)가 큐를 두 번 만들지 않습니다. */
    cue(sessionId: string, user: TeamIdentity, entryId: unknown, cueId: unknown): LiveCueRecord {
        const row = this.row(sessionId);
        this.requireOpen(row);
        const member = this.memberOf(row.team_id, user.id);
        const id = text(entryId, 64);
        const definition = typeof cueId === 'string' ? cueById(cueId) : undefined;
        if (!id || !definition) throw new Error('보낼 큐를 확인해주세요.');
        const existing = this.db.prepare('SELECT * FROM live_cues WHERE id = ?').get(id) as CueRow | undefined;
        if (existing) {
            if (existing.session_id !== sessionId || existing.from_user !== user.id || existing.cue_id !== definition.id) throw new Error('보낼 큐를 확인해주세요.');
            return this.cueRecord(existing);
        }
        if (definition.target === 'all' && !can(member, this.teams.policy(row.team_id), 'cueAll')) throw new Error('전체 큐를 보낼 권한이 없습니다.');
        const present = this.presentIds(sessionId);
        // 받는 사람: 지금 들어와 있는 사람 중 받는 묶음에 속한 사람 (보낸 사람 제외)
        const recipients = this.members(row.team_id)
            .filter((item) => item.userId !== user.id && present.has(item.userId))
            .filter((item) => definition.target === 'all' || cueGroupOf(item.role) === definition.target)
            .map((item) => item.userId);
        const now = new Date().toISOString();
        this.db.prepare('INSERT INTO live_cues(id, session_id, cue_id, label, target, from_user, from_name, created_at, recipients_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, sessionId, definition.id, definition.label, definition.target, user.id, member.name, now, JSON.stringify(recipients));
        this.db.prepare('UPDATE live_sessions SET last_activity_at = ? WHERE id = ?').run(now, sessionId);
        const record: LiveCueRecord = { id, cueId: definition.id, label: definition.label, target: definition.target, fromUserId: user.id, fromName: member.name, createdAt: now, recipients, acks: [] };
        this.events.publish(row.team_id, 'live.cue', { sessionId, cue: record, targetLabel: CUE_TARGET_LABEL[definition.target] }, [user.id, ...recipients]);
        return record;
    }

    ack(sessionId: string, user: TeamIdentity, entryId: unknown): void {
        const row = this.row(sessionId);
        const member = this.memberOf(row.team_id, user.id);
        const cue = typeof entryId === 'string' ? this.db.prepare('SELECT * FROM live_cues WHERE id = ? AND session_id = ?').get(entryId, sessionId) as CueRow | undefined : undefined;
        if (!cue) throw new Error('큐를 찾지 못했습니다.');
        const recipients = JSON.parse(cue.recipients_json) as string[];
        if (!recipients.includes(user.id)) throw new Error('나에게 온 큐가 아닙니다.');
        const at = new Date().toISOString();
        const result = this.db.prepare('INSERT OR IGNORE INTO live_acks(cue_id, user_id, name, at) VALUES (?, ?, ?, ?)').run(cue.id, user.id, member.name, at);
        if (result.changes) this.events.publish(row.team_id, 'live.ack', { sessionId, cueId: cue.id, userId: user.id, name: member.name, at }, [cue.from_user, user.id]);
    }
}
