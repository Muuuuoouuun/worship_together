import type Database from 'better-sqlite3';

/*
 * SQLite 쓰기 잠금 충돌 처리. 서버 프로세스가 둘 이상(배포 · 개발 서버 재시작)이어도 같은 파일을 안전하게 씁니다.
 * - 쓰기는 BEGIN IMMEDIATE 로 시작해 처음부터 쓰기 잠금을 잡습니다. 그래야 busy_timeout 동안 기다립니다
 *   (BEGIN DEFERRED 로 읽다가 쓰기로 올리면, 그새 다른 프로세스가 저장한 경우 기다리지 않고 바로 SQLITE_BUSY_SNAPSHOT 이 납니다).
 * - 그래도 잠금 충돌이면 한 번 더 시도하고, 그래도 안 되면 화면에 보여 줄 한국어 안내로 바꿔 던집니다.
 *   기다리는 동안 이벤트 루프가 멈추므로 busy_timeout 은 짧게(teamRepository BUSY_TIMEOUT_MS) 두고,
 *   잃어도 되는 쓰기(팀 소식 publish)는 attempts: 1 로 다시 시도하지 않습니다.
 * - 트랜잭션 안에서는 소식(events.publish)을 내보내지 않습니다. 저장이 끝난(커밋된) 뒤에 내보내야
 *   되돌려진 저장의 소식을 다른 화면이 받지 않고, 다시 시도할 때 소식이 두 번 나가지도 않습니다.
 */

export const SQLITE_BUSY_MESSAGE = '다른 기기에서 저장 중이에요. 잠시 후 다시 시도해주세요.';

/** better-sqlite3 가 잠금 충돌로 던진 오류인지 (SQLITE_BUSY · SQLITE_BUSY_SNAPSHOT · SQLITE_BUSY_TIMEOUT · SQLITE_LOCKED …) */
export function isSqliteBusy(error: unknown): boolean {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    return typeof code === 'string' && (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED'));
}

/** 다시 시도해도 잠금 충돌이 풀리지 않았을 때 던지는 오류 (메시지는 화면에 그대로 보여 줘도 되는 한국어) */
export class SqliteBusyError extends Error {
    readonly code = 'WT_SQLITE_BUSY';
    constructor(cause: unknown) {
        super(SQLITE_BUSY_MESSAGE, { cause });
        this.name = 'SqliteBusyError';
    }
}

/**
 * fn 을 부르고, 잠금 충돌이면 attempts 번까지 다시 부릅니다. 다른 오류는 그대로 던집니다.
 * fn 은 다시 불려도 괜찮아야 합니다 — 트랜잭션 하나(되돌려지면 아무 일도 없던 것)만 넣으세요.
 * 저장소 메서드의 바깥 경계에서만 씁니다. 다른 트랜잭션 안에서 다시 시도하면 바깥 트랜잭션은 이미 깨진 상태입니다.
 */
export function withBusyRetry<T>(fn: () => T, { attempts = 2 }: { attempts?: number } = {}): T {
    const limit = Math.max(1, Math.floor(attempts));
    for (let attempt = 1; ; attempt += 1) {
        try {
            return fn();
        } catch (error) {
            if (!isSqliteBusy(error)) throw error;
            if (attempt >= limit) throw new SqliteBusyError(error);
        }
    }
}

/**
 * 쓰기 트랜잭션 하나: BEGIN IMMEDIATE 로 쓰기 잠금을 먼저 잡고, 잠금 충돌이면 한 번 더 시도합니다.
 * 이미 다른 트랜잭션 안이면 그 트랜잭션의 일부(SAVEPOINT)로 돌고 다시 시도하지 않습니다 — 바깥 경계가 맡습니다.
 */
export function writeTransaction<T>(db: Database.Database, fn: () => T, options?: { attempts?: number }): T {
    if (db.inTransaction) return db.transaction(fn)();
    return withBusyRetry(() => db.transaction(fn).immediate(), options);
}
