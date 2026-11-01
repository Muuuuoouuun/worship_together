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
    /** 일정 · 요청 알림 하나 (받는 사람에게만) */
    | 'planning.notice'
    | 'team.changed'
    | 'live.started'
    | 'live.ended'
    | 'live.state'
    | 'live.presence'
    | 'live.cue'
    | 'live.ack'
    /** 다시 연결했는데 놓친 소식을 이어 줄 수 없음 — 처음부터 다시 읽으라는 신호 (저장하지 않고 흐름에서만 보냄) */
    | 'stream.reset';

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
/** 다시 연결한 화면에 한 번에 이어 보내는 소식 수. 이보다 많이 놓쳤으면 처음부터 다시 맞추게 합니다. */
export const CATCH_UP_LIMIT = 300;

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
    /** 팀마다 정리한 뒤로 쌓인 소식 수 */
    private published = new Map<string, number>();

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
        const count = (this.published.get(teamId) ?? 0) + 1;
        this.published.set(teamId, count % 50);
        if (count >= 50) {
            // 번호는 모든 팀이 함께 쓰므로, 이 팀의 최근 KEEP_PER_TEAM 개를 세어서 그보다 오래된 것을 지웁니다.
            const floor = this.db.prepare('SELECT id FROM team_events WHERE team_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?').get(teamId, KEEP_PER_TEAM) as { id: number } | undefined;
            if (floor) this.db.prepare('DELETE FROM team_events WHERE team_id = ? AND id <= ?').run(teamId, floor.id);
        }
        this.emitter.emit(teamId, event);
        return event;
    }

    /** afterId 다음 소식 (이 사람이 받을 것만) */
    since(teamId: string, afterId: number, userId: string, limit = CATCH_UP_LIMIT): TeamEvent[] {
        const rows = this.db.prepare('SELECT * FROM team_events WHERE team_id = ? AND id > ? ORDER BY id LIMIT ?').all(teamId, afterId, limit) as Row[];
        return rows.map(toEvent).filter((event) => visibleTo(event, userId));
    }

    /**
     * afterId 다음부터 이어 받을 수 없는지 — 그사이 소식이 정리됐거나 너무 많이 쌓였으면 true.
     * afterId 는 이 팀 소식의 번호이므로, 남은 가장 오래된 소식보다 앞이면 그 소식은 정리된 것입니다.
     * 그때 화면은 이어 받지 말고 팀 자료 · 일정 · 예배를 처음부터 다시 읽어야 합니다.
     */
    hasGap(teamId: string, afterId: number): boolean {
        const oldest = (this.db.prepare('SELECT min(id) AS id FROM team_events WHERE team_id = ?').get(teamId) as { id: number | null }).id;
        if (oldest !== null && afterId < oldest) return true;
        const missed = (this.db.prepare('SELECT count(*) AS n FROM (SELECT 1 FROM team_events WHERE team_id = ? AND id > ? LIMIT ?)').get(teamId, afterId, CATCH_UP_LIMIT + 1) as { n: number }).n;
        return missed > CATCH_UP_LIMIT;
    }

    /** 여러 팀에서 afterId 다음 소식 중 types 에 해당하고 이 사람이 받을 것 (번호는 모든 팀이 함께 쓰므로 한 줄로 이어 받습니다) */
    sinceAcross(teamIds: string[], afterId: number, userId: string, types: TeamEventType[], limit = CATCH_UP_LIMIT): TeamEvent[] {
        if (!teamIds.length || !types.length) return [];
        const rows = this.db.prepare(`SELECT * FROM team_events WHERE team_id IN (${teamIds.map(() => '?').join(',')}) AND type IN (${types.map(() => '?').join(',')}) AND id > ? ORDER BY id LIMIT ?`)
            .all(...teamIds, ...types, afterId, limit) as Row[];
        return rows.map(toEvent).filter((event) => visibleTo(event, userId));
    }

    /** 모든 팀을 통틀어 가장 최근 소식 번호 */
    latestIdOverall(): number {
        return (this.db.prepare('SELECT coalesce(max(id), 0) AS id FROM team_events').get() as { id: number }).id;
    }

    latestId(teamId: string): number {
        return (this.db.prepare('SELECT coalesce(max(id), 0) AS id FROM team_events WHERE team_id = ?').get(teamId) as { id: number }).id;
    }

    subscribe(teamId: string, listener: (event: TeamEvent) => void): () => void {
        this.emitter.on(teamId, listener);
        return () => this.emitter.off(teamId, listener);
    }
}
