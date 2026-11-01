import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SQLITE_BUSY_MESSAGE, SqliteBusyError, isSqliteBusy, withBusyRetry, writeTransaction } from '../lib/server/sqliteRetry';
import { TeamRepository } from '../lib/server/teamRepository';
import { TeamEvents, type TeamEvent } from '../lib/server/teamEvents';
import { TeamDocs } from '../lib/server/teamDocs';
import { LiveRepository } from '../lib/server/liveRepository';

/*
 * SQLite 쓰기: 서버 프로세스가 둘 이상이어도 저장이 잠금 충돌로 바로 실패하지 않고(BEGIN IMMEDIATE + 한 번 더 시도),
 * 팀 소식은 저장이 커밋된 뒤에만 나가는지.
 */

const busy = (code = 'SQLITE_BUSY') => Object.assign(new Error(`database is locked (${code})`), { code });

function tempFile() {
    const folder = mkdtempSync(path.join(tmpdir(), 'worship-sqlite-'));
    return { file: path.join(folder, 'teams.sqlite'), cleanup: () => rmSync(folder, { recursive: true, force: true }) };
}

test('isSqliteBusy recognises busy/locked codes only', () => {
    for (const code of ['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_BUSY_RECOVERY', 'SQLITE_BUSY_TIMEOUT', 'SQLITE_LOCKED', 'SQLITE_LOCKED_SHAREDCACHE']) assert.equal(isSqliteBusy(busy(code)), true, code);
    for (const value of [new Error('x'), Object.assign(new Error('x'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }), null, 'SQLITE_BUSY', { code: 1 }]) assert.equal(isSqliteBusy(value), false);
});

test('withBusyRetry retries a busy failure once and returns the second result', () => {
    let calls = 0;
    const value = withBusyRetry(() => {
        calls += 1;
        if (calls === 1) throw busy('SQLITE_BUSY_SNAPSHOT');
        return 'saved';
    }, { attempts: 2 });
    assert.equal(value, 'saved');
    assert.equal(calls, 2);
});

test('withBusyRetry gives up after the attempts with a Korean message and keeps the cause', () => {
    for (const code of ['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_LOCKED']) {
        let calls = 0;
        const last = busy(code);
        assert.throws(() => withBusyRetry(() => { calls += 1; throw last; }, { attempts: 2 }), (error: unknown) => {
            assert.ok(error instanceof SqliteBusyError);
            assert.equal(error.message, '다른 기기에서 저장 중이에요. 잠시 후 다시 시도해주세요.');
            assert.equal(error.message, SQLITE_BUSY_MESSAGE);
            assert.equal(error.code, 'WT_SQLITE_BUSY');
            assert.equal(error.cause, last);
            return true;
        });
        assert.equal(calls, 2, code);
    }
});

test('withBusyRetry does not retry other errors (validation, constraints)', () => {
    let calls = 0;
    const failure = new Error('팀 이름은 1~40자로 입력해주세요.');
    assert.throws(() => withBusyRetry(() => { calls += 1; throw failure; }), (error) => error === failure);
    assert.equal(calls, 1);
});

test('a deferred read-then-write loses to another connection\'s commit (SQLITE_BUSY_SNAPSHOT); writeTransaction takes the write lock up front instead', () => {
    const { file, cleanup } = tempFile();
    const a = new Database(file), b = new Database(file);
    try {
        a.pragma('journal_mode = WAL');
        a.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
        b.pragma('busy_timeout = 0');
        // 예전 방식: BEGIN DEFERRED 로 읽는 사이 다른 연결이 저장하면, 쓰기로 올릴 때 기다리지 않고 바로 실패
        assert.throws(() => a.transaction(() => {
            a.prepare('SELECT count(*) FROM notes').get();
            b.prepare("INSERT INTO notes(body) VALUES ('other process')").run();
            a.prepare("INSERT INTO notes(body) VALUES ('mine')").run();
        })(), (error: unknown) => (error as { code?: string }).code === 'SQLITE_BUSY_SNAPSHOT');
        // writeTransaction: 읽기 전에 이미 쓰기 잠금을 잡아서, 다른 연결이 끼어들지 못하고(실제로는 busy_timeout 동안 기다림) 내 저장은 성공
        const count = writeTransaction(a, () => {
            const before = (a.prepare('SELECT count(*) AS n FROM notes').get() as { n: number }).n;
            assert.throws(() => b.prepare("INSERT INTO notes(body) VALUES ('other process')").run(), (error: unknown) => isSqliteBusy(error));
            a.prepare("INSERT INTO notes(body) VALUES ('mine')").run();
            return before + 1;
        });
        assert.equal(a.inTransaction, false);
        assert.equal((b.prepare('SELECT count(*) AS n FROM notes').get() as { n: number }).n, count);
        b.prepare("INSERT INTO notes(body) VALUES ('other process')").run();
    } finally { a.close(); b.close(); cleanup(); }
});

test('writeTransaction inside another transaction runs as a savepoint and leaves retrying to the outer boundary', () => {
    const db = new Database(':memory:');
    try {
        db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
        let inner = 0;
        assert.throws(() => writeTransaction(db, () => {
            db.prepare("INSERT INTO notes(body) VALUES ('outer')").run();
            writeTransaction(db, () => { inner += 1; assert.equal(db.inTransaction, true); throw busy(); });
        }), SqliteBusyError);
        // 바깥이 두 번 시도 × 안쪽은 다시 시도하지 않음 = 2 (안쪽도 다시 시도했다면 4)
        assert.equal(inner, 2);
        assert.equal((db.prepare('SELECT count(*) AS n FROM notes').get() as { n: number }).n, 0);
        // 안쪽 실패를 바깥이 잡으면 안쪽 쓰기만 되돌려집니다.
        writeTransaction(db, () => {
            db.prepare("INSERT INTO notes(body) VALUES ('kept')").run();
            try { writeTransaction(db, () => { db.prepare("INSERT INTO notes(body) VALUES ('undone')").run(); throw new Error('inner'); }); } catch { /* 안쪽만 실패 */ }
        });
        assert.deepEqual(db.prepare('SELECT body FROM notes').all(), [{ body: 'kept' }]);
    } finally { db.close(); }
});

test('a repository write blocked by another process retries once, then fails with the Korean busy message; it succeeds once the lock is released', () => {
    const { file, cleanup } = tempFile();
    const repo = new TeamRepository(file);
    const other = new Database(file);
    try {
        const owner = { id: 'busy-owner', name: '인도자' };
        const team = repo.create('잠금 테스트 팀', owner);
        repo.database.pragma('busy_timeout = 0');
        const command = { type: 'request.create', setlistId: '', setlistTitle: '콘티', kind: 'question', body: '질문', leaderId: owner.id };
        other.exec('BEGIN IMMEDIATE');
        assert.throws(() => repo.updatePlanning(team.id, owner.id, command), (error: unknown) => error instanceof Error && error.message === SQLITE_BUSY_MESSAGE);
        other.exec('COMMIT');
        assert.equal(repo.updatePlanning(team.id, owner.id, command).requests.length, 1);
    } finally { other.close(); repo.close(); cleanup(); }
});

test('team events are emitted only after the write is committed (visible to another connection, no open transaction)', () => {
    const { file, cleanup } = tempFile();
    const teams = new TeamRepository(file);
    const events = new TeamEvents(teams.database);
    const docs = new TeamDocs(teams.database, teams, events);
    const live = new LiveRepository(teams.database, teams, events);
    const reader = new Database(file, { readonly: true });
    try {
        const leader = { id: 'commit-leader', name: '인도자' };
        const team = teams.create('커밋 테스트 팀', leader);
        const seen: { event: TeamEvent; inTransaction: boolean; committed: boolean }[] = [];
        events.subscribe(team.id, (event) => {
            const payload = event.payload as Record<string, unknown>;
            let committed = (reader.prepare('SELECT count(*) AS n FROM team_events WHERE id = ?').get(event.id) as { n: number }).n === 1;
            if (event.type === 'docs.changed') {
                committed &&= (reader.prepare('SELECT version FROM online_docs WHERE team_id = ? AND doc_key = ?').get(team.id, payload.key) as { version: number } | undefined)?.version === payload.version;
            }
            if (event.type === 'live.state') {
                const row = reader.prepare('SELECT state_json FROM live_sessions WHERE id = ?').get(payload.sessionId) as { state_json: string };
                committed &&= (JSON.parse(row.state_json) as { version: number }).version === (payload.state as { version: number }).version;
            }
            if (event.type === 'live.started') committed &&= Boolean(reader.prepare('SELECT 1 FROM live_sessions WHERE id = ?').get(payload.id));
            seen.push({ event, inTransaction: teams.database.inTransaction, committed });
        });
        const key = `worship-together:library:v1:${encodeURIComponent(team.id)}`;
        const saved = docs.put(team.id, leader, key, JSON.stringify({ version: 1, songs: [], setlists: [] }), 0);
        assert.equal(saved.ok, true);
        // 같은 내용 다시 저장 · 오래된 baseVersion → 저장하지 않으므로 소식도 없음
        docs.put(team.id, leader, key, JSON.stringify({ version: 1, songs: [], setlists: [] }), (saved as { version: number }).version);
        docs.put(team.id, leader, key, JSON.stringify({ version: 1, songs: [{ id: 'x' }], setlists: [] }), 0);
        const snapshot = { setlistId: 's', title: '주일', dateLabel: null, theme: null, songs: [{ id: 'a', title: '곡', key: 'D', bpm: 70, meter: '4/4', sections: ['V', 'C'], note: null, transitionNote: null, lead: null }] };
        const { session } = live.start(team.id, leader, snapshot);
        assert.equal(live.start(team.id, leader, snapshot).created, false);
        live.join(session.id, leader.id, 'device-0001');
        live.move(session.id, leader, { sectionIndex: 1 });
        live.move(session.id, leader, { sectionIndex: 1 });
        live.end(session.id, leader);
        assert.deepEqual(seen.map((item) => item.event.type), ['docs.changed', 'live.started', 'live.presence', 'live.state', 'live.ended']);
        for (const item of seen) {
            assert.equal(item.inTransaction, false, `${item.event.type} emitted inside a transaction`);
            assert.equal(item.committed, true, `${item.event.type} emitted before its write was visible to other connections`);
        }
    } finally { reader.close(); teams.close(); cleanup(); }
});
