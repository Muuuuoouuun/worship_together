export const DEMO_TEAM_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_SESSION_ID = '00000000-0000-0000-0000-000000000201';

export function isPrototypeSessionId(id: string): boolean {
    return id === DEMO_SESSION_ID || id.startsWith('prototype-');
}
