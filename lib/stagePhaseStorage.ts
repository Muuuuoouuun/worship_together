/**
 * Remembers, per browser tab, that this device already left the worship start screen,
 * so a reload mid-service returns to the stage instead of the start screen again.
 */
export interface StoredStagePhase {
    /** Wall-clock ms when the count-in finished; null when the stage was opened without one. */
    startedAt: number | null;
}

export function getStagePhaseStorageKey(sessionId: string): string {
    return `worship-together:session:${sessionId}:stage-phase`;
}

export function parseStagePhase(raw: string | null): StoredStagePhase | null {
    if (!raw) return null;
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || !('startedAt' in value)) return null;
        const { startedAt } = value as { startedAt: unknown };
        if (startedAt === null) return { startedAt: null };
        return typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt > 0 ? { startedAt } : null;
    } catch {
        return null;
    }
}

export function readStagePhase(sessionId: string): StoredStagePhase | null {
    try {
        return parseStagePhase(window.sessionStorage.getItem(getStagePhaseStorageKey(sessionId)));
    } catch {
        return null;
    }
}

export function writeStagePhase(sessionId: string, value: StoredStagePhase): void {
    try {
        window.sessionStorage.setItem(getStagePhaseStorageKey(sessionId), JSON.stringify(value));
    } catch {
        // Private mode or blocked storage: the stage still works, it just won't survive a reload.
    }
}

export function clearStagePhase(sessionId: string): void {
    try {
        window.sessionStorage.removeItem(getStagePhaseStorageKey(sessionId));
    } catch {
        // Nothing stored to clear.
    }
}
