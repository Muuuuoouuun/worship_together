import type Database from 'better-sqlite3';
import { can } from '../permissions';
import type { TeamIdentity } from '../../types/team';
import type { TeamRepository } from './teamRepository';
import type { TeamEvents } from './teamEvents';

/*
 * 팀 공유 자료. 온라인 팀의 콘티 · 곡 보관함 · 송폼 · 곡 링크는 서버가 원본이고, 각 기기의 브라우저 저장소는 사본입니다.
 * 화면은 지금처럼 브라우저 저장소를 읽고 쓰며, 동기화(lib/teamDocSync)가 바뀐 문서를 여기로 올리고 받아 옵니다.
 * 문서 키는 브라우저 저장소 키를 그대로 쓰되, 이 팀의 키인지 · 어떤 종류인지 서버가 다시 확인합니다.
 */

export type TeamDocKind = 'library' | 'setlist-details' | 'song-form' | 'song-links';

export interface TeamDoc {
    key: string;
    kind: TeamDocKind;
    json: string;
    version: number;
    updatedAt: string;
    updatedByName: string;
}

export type PutResult = { ok: true; version: number } | { ok: false; conflict: TeamDoc | null; error?: string };

const MAX_DOC_BYTES = 1_000_000;
const MAX_TEAM_BYTES = 30_000_000;

export function classifyDocKey(teamId: string, key: string): TeamDocKind | null {
    if (typeof key !== 'string' || key.length > 400) return null;
    const team = encodeURIComponent(teamId);
    if (key === `worship-together:library:v1:${team}`) return 'library';
    if (key === `worship-together:song-links:v1:${team}`) return 'song-links';
    if (key.startsWith(`worship:setlist-details:v1:${team}:`) && key.length > `worship:setlist-details:v1:${team}:`.length) return 'setlist-details';
    if (key.startsWith(`worship-together:song-form:v1:${team}:`) && key.length > `worship-together:song-form:v1:${team}:`.length) return 'song-form';
    return null;
}

type Comment = { id?: unknown };

/** 편집 권한이 없는 팀원은 콘티 세부 정보에 코멘트만 더할 수 있습니다 (다른 부분 · 남의 코멘트는 그대로여야 함). */
function onlyAddsComments(before: string | null, after: string): boolean {
    try {
        const next = JSON.parse(after) as Record<string, unknown>;
        const nextComments = Array.isArray(next.comments) ? next.comments as Comment[] : [];
        const strip = (value: Record<string, unknown>) => JSON.stringify({ ...value, comments: undefined, updatedAt: undefined });
        if (!before) {
            const overrides = next.overrides && typeof next.overrides === 'object' ? Object.keys(next.overrides as object) : [];
            return overrides.length === 0 && !next.owner && !next.status;
        }
        const prev = JSON.parse(before) as Record<string, unknown>;
        if (strip(prev) !== strip(next)) return false;
        const prevComments = Array.isArray(prev.comments) ? prev.comments as Comment[] : [];
        const kept = new Map(nextComments.map((comment) => [comment.id, JSON.stringify(comment)]));
        return prevComments.every((comment) => kept.get(comment.id) === JSON.stringify(comment)) && nextComments.length >= prevComments.length;
    } catch {
        return false;
    }
}

export class TeamDocs {
    constructor(private db: Database.Database, private teams: TeamRepository, private events: TeamEvents) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS online_docs (
                team_id TEXT NOT NULL REFERENCES online_teams(id) ON DELETE CASCADE,
                doc_key TEXT NOT NULL,
                kind TEXT NOT NULL,
                json TEXT NOT NULL,
                version INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by TEXT NOT NULL,
                updated_by_name TEXT NOT NULL,
                PRIMARY KEY(team_id, doc_key)
            );
            CREATE INDEX IF NOT EXISTS online_docs_version ON online_docs(team_id, version);
        `);
    }

    private member(teamId: string, userId: string) {
        const member = this.teams.membership(teamId, userId);
        if (!member) throw new Error('이 팀에 접근할 수 없습니다.');
        return member;
    }

    /** since 이후에 바뀐 문서. cursor 는 다음에 넘길 값 */
    list(teamId: string, userId: string, since = 0): { docs: TeamDoc[]; cursor: number } {
        this.member(teamId, userId);
        const rows = this.db.prepare('SELECT doc_key AS key, kind, json, version, updated_at AS updatedAt, updated_by_name AS updatedByName FROM online_docs WHERE team_id = ? AND version > ? ORDER BY version').all(teamId, Math.max(0, Math.floor(since) || 0)) as TeamDoc[];
        const cursor = (this.db.prepare('SELECT coalesce(max(version), 0) AS v FROM online_docs WHERE team_id = ?').get(teamId) as { v: number }).v;
        return { docs: rows, cursor };
    }

    /**
     * baseVersion 은 이 기기가 마지막으로 받은 그 문서의 version (처음이면 0).
     * 그 사이 다른 사람이 저장했으면 저장하지 않고 서버 문서를 돌려줍니다 — 기기가 합친 뒤 다시 올립니다.
     */
    put(teamId: string, user: TeamIdentity, key: string, json: unknown, baseVersion: unknown): PutResult {
        const member = this.member(teamId, user.id);
        const kind = classifyDocKey(teamId, key);
        if (!kind) return { ok: false, conflict: null, error: '이 팀의 자료가 아닙니다.' };
        if (typeof json !== 'string' || json.length > MAX_DOC_BYTES) return { ok: false, conflict: null, error: '자료가 너무 큽니다.' };
        try { JSON.parse(json); } catch { return { ok: false, conflict: null, error: '자료 형식이 올바르지 않습니다.' }; }
        return this.db.transaction((): PutResult => {
            const current = this.db.prepare('SELECT doc_key AS key, kind, json, version, updated_at AS updatedAt, updated_by_name AS updatedByName FROM online_docs WHERE team_id = ? AND doc_key = ?').get(teamId, key) as TeamDoc | undefined;
            if ((current?.version ?? 0) !== (Number(baseVersion) || 0)) return { ok: false, conflict: current ?? null };
            if (current?.json === json) return { ok: true, version: current.version };
            const policy = this.teams.policy(teamId);
            const allowed = can(member, policy, 'contiEdit') || (kind === 'setlist-details' && onlyAddsComments(current?.json ?? null, json));
            if (!allowed) return { ok: false, conflict: current ?? null, error: '콘티를 편집할 권한이 없습니다. 코멘트는 남길 수 있어요.' };
            const total = (this.db.prepare('SELECT coalesce(sum(length(json)), 0) AS n FROM online_docs WHERE team_id = ? AND doc_key <> ?').get(teamId, key) as { n: number }).n;
            if (total + json.length > MAX_TEAM_BYTES) return { ok: false, conflict: null, error: '팀 저장 공간이 가득 찼습니다.' };
            const version = (this.db.prepare('SELECT coalesce(max(version), 0) + 1 AS v FROM online_docs WHERE team_id = ?').get(teamId) as { v: number }).v;
            const now = new Date().toISOString();
            this.db.prepare(`INSERT INTO online_docs(team_id, doc_key, kind, json, version, updated_at, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(team_id, doc_key) DO UPDATE SET json = excluded.json, version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name`)
                .run(teamId, key, kind, json, version, now, user.id, member.name);
            this.events.publish(teamId, 'docs.changed', { key, kind, version, by: user.id, byName: member.name });
            return { ok: true, version };
        })();
    }
}
