import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';

/*
 * 팀 소식 흐름. 저장(콘티 · 일정) · 팀 변경 · 예배 세션의 모든 변화가 여기 한 줄로 쌓이고,
 * 열려 있는 화면(/api/teams/[teamId]/stream)으로 바로 흘러갑니다.
 * 끊겼다 다시 붙은 화면은 마지막으로 받은 id 다음부터 다시 받으므로 놓친 큐가 없습니다.
 */

export type TeamEventType =
    | 'docs.changed'
    | 'planning.changed'
    | 'team.changed'
    | 'live.started'
    | 'live.ended'
    | 'live.state'
    | 'live.presence'
    | 'live.cue'
    | 'live.ack';

export interface TeamEvent {
    id: number;
    teamId: string;
    type: TeamEventType;
    payload: unknown;
    /** 받을 사람 (null 이면 팀 전체) */
    audience: string[] | null;
    createdAt: string;
}

type Row = { id: number; team_id: string; type: TeamEventType; payload_json: string; audience_json: string | null; created_at: string };

/** 팀마다 남겨 두는 최근 소식 수 — 다시 연결한 화면이 따라잡을 만큼만 */
const KEEP_PER_TEAM = 600;

function toEvent(row: Row): TeamEvent {
    return {
        id: row.id,
        teamId: row.team_id,
        type: row.type,
        payload: JSON.parse(row.payload_json),
        audience: row.audience_json ? JSON.parse(row.audience_json) as string[] : null,
        createdAt: row.created_at,
    };
}

export function visibleTo(event: TeamEvent, userId: string): boolean {
    return !event.audience || event.audience.includes(userId);
}

export class TeamEvents {
    private emitter = new EventEmitter();
    private published = 0;

    constructor(private db: Database.Database) {
        this.emitter.setMaxListeners(0);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS team_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id TEXT NOT NULL REFERENCES online_teams(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                audience_json TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS team_events_team ON team_events(team_id, id);
        `);
    }

    publish(teamId: string, type: TeamEventType, payload: unknown, audience: string[] | null = null): TeamEvent {
        const createdAt = new Date().toISOString();
        const result = this.db.prepare('INSERT INTO team_events(team_id, type, payload_json, audience_json, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(teamId, type, JSON.stringify(payload ?? null), audience ? JSON.stringify([...new Set(audience)]) : null, createdAt);
        const event: TeamEvent = { id: Number(result.lastInsertRowid), teamId, type, payload, audience: audience ? [...new Set(audience)] : null, createdAt };
        this.published += 1;
        if (this.published % 50 === 0) {
            this.db.prepare('DELETE FROM team_events WHERE team_id = ? AND id <= ?').run(teamId, event.id - KEEP_PER_TEAM);
        }
        this.emitter.emit(teamId, event);
        return event;
    }

    /** afterId 다음 소식 (이 사람이 받을 것만) */
    since(teamId: string, afterId: number, userId: string, limit = 300): TeamEvent[] {
        const rows = this.db.prepare('SELECT * FROM team_events WHERE team_id = ? AND id > ? ORDER BY id LIMIT ?').all(teamId, afterId, limit) as Row[];
        return rows.map(toEvent).filter((event) => visibleTo(event, userId));
    }

    latestId(teamId: string): number {
        return (this.db.prepare('SELECT coalesce(max(id), 0) AS id FROM team_events WHERE team_id = ?').get(teamId) as { id: number }).id;
    }

    subscribe(teamId: string, listener: (event: TeamEvent) => void): () => void {
        this.emitter.on(teamId, listener);
        return () => this.emitter.off(teamId, listener);
    }
}
