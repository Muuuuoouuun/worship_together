import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SESSION_ID, DEMO_TEAM_ID } from '../lib/constants';
import { DEFAULT_POLICY } from '../lib/permissions';
import { LIBRARY_DENIAL_MESSAGES, canMutateLibrary, canReadLegacySession, type LibraryAccessInput } from '../lib/legacyAccess';
import { getSessionDetail } from '../lib/data';

/*
 * 예전 Supabase 경로의 권한: 곡 보관함 서버 액션(actions/libraryActions)과 /session/[id] 세션 읽기(lib/data).
 * Supabase 연결이 없으면 지금처럼 동작하고, 있으면 로그인한 온라인 팀원(편집 권한)만 바꾸고 읽습니다.
 */

const user = { id: 'legacy-user' };
const onlineTeam = 'online-team-uuid';
const leader = { permission: 'member' as const, role: 'leader' as const };
const vocal = { permission: 'member' as const, role: 'vocal' as const };
const owner = { permission: 'owner' as const, role: 'keyboard' as const };

function input(overrides: Partial<LibraryAccessInput> = {}): LibraryAccessInput {
    return { user, teamId: onlineTeam, isOnlineTeam: true, membership: leader, policy: DEFAULT_POLICY, supabaseConfigured: true, ...overrides };
}

test('canMutateLibrary: without Supabase every team keeps the current "backend-unavailable" behaviour, signed in or not', () => {
    for (const teamId of [DEMO_TEAM_ID, onlineTeam, 'prototype-team']) {
        assert.deepEqual(canMutateLibrary(input({ teamId, supabaseConfigured: false })), { ok: false, reason: 'backend-unavailable' });
        assert.deepEqual(canMutateLibrary(input({ teamId, supabaseConfigured: false, user: null, membership: null })), { ok: false, reason: 'backend-unavailable' });
    }
});

test('canMutateLibrary: with Supabase an anonymous caller is asked to sign in first', () => {
    assert.deepEqual(canMutateLibrary(input({ user: null })), { ok: false, reason: 'sign-in-required' });
    assert.deepEqual(canMutateLibrary(input({ user: { id: '' } })), { ok: false, reason: 'sign-in-required' });
    assert.deepEqual(canMutateLibrary(input({ user: null, teamId: DEMO_TEAM_ID, isOnlineTeam: false, membership: null })), { ok: false, reason: 'sign-in-required' });
});

test('canMutateLibrary: with Supabase the shared demo team, unknown teams and empty team ids are rejected even for signed-in users', () => {
    assert.deepEqual(canMutateLibrary(input({ teamId: DEMO_TEAM_ID, isOnlineTeam: false, membership: null })), { ok: false, reason: 'library-forbidden' });
    // 데모 팀 id 가 혹시 온라인 팀 명단에 있어도 공용 예시라 막습니다.
    assert.deepEqual(canMutateLibrary(input({ teamId: DEMO_TEAM_ID, membership: owner })), { ok: false, reason: 'library-forbidden' });
    // 브라우저 프로토타입 팀 · Supabase 에만 있는 팀: 팀원인지 확인할 수 없음
    assert.deepEqual(canMutateLibrary(input({ teamId: 'prototype-team', isOnlineTeam: false, membership: null })), { ok: false, reason: 'library-forbidden' });
    assert.deepEqual(canMutateLibrary(input({ teamId: '' })), { ok: false, reason: 'library-forbidden' });
});

test('canMutateLibrary: online teams need membership and the contiEdit permission (same rule as team doc writes)', () => {
    assert.deepEqual(canMutateLibrary(input({ membership: null })), { ok: false, reason: 'library-forbidden' });
    assert.deepEqual(canMutateLibrary(input({ membership: vocal })), { ok: false, reason: 'library-forbidden' });
    assert.deepEqual(canMutateLibrary(input({ membership: leader })), { ok: true });
    assert.deepEqual(canMutateLibrary(input({ membership: owner })), { ok: true });
    // 정책이 '모든 팀원' 이면 일반 팀원도, '관리자만' 이면 인도자도 막힘
    assert.deepEqual(canMutateLibrary(input({ membership: vocal, policy: { ...DEFAULT_POLICY, contiEdit: 'everyone' } })), { ok: true });
    assert.deepEqual(canMutateLibrary(input({ membership: leader, policy: { ...DEFAULT_POLICY, contiEdit: 'admins' } })), { ok: false, reason: 'library-forbidden' });
    assert.deepEqual(canMutateLibrary(input({ membership: owner, policy: { ...DEFAULT_POLICY, contiEdit: 'admins' } })), { ok: true });
    // 정책을 넘기지 않으면 기본 정책(관리자 · 인도자)
    assert.deepEqual(canMutateLibrary(input({ membership: vocal, policy: undefined })), { ok: false, reason: 'library-forbidden' });
});

test('library denial keys map to the Korean notices the library page shows', () => {
    assert.equal(LIBRARY_DENIAL_MESSAGES['sign-in-required'], '로그인 후 다시 시도해주세요.');
    assert.equal(LIBRARY_DENIAL_MESSAGES['library-forbidden'], '이 팀의 곡을 바꿀 권한이 없어요.');
});

test('canReadLegacySession: demo and prototype sessions are open; server sessions need a signed-in member of that team', () => {
    assert.equal(canReadLegacySession({ sessionId: DEMO_SESSION_ID, user: null, teamId: DEMO_TEAM_ID, membership: null }), true);
    assert.equal(canReadLegacySession({ sessionId: 'prototype-set-1', user: null, teamId: null, membership: null }), true);
    const sessionId = '6f1c2f8e-0000-4000-8000-000000000001';
    assert.equal(canReadLegacySession({ sessionId, user: null, teamId: onlineTeam, membership: leader }), false);
    assert.equal(canReadLegacySession({ sessionId, user, teamId: null, membership: leader }), false);
    assert.equal(canReadLegacySession({ sessionId, user, teamId: onlineTeam, membership: null }), false);
    assert.equal(canReadLegacySession({ sessionId, user, teamId: onlineTeam, membership: vocal }), true);
});

const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

test('getSessionDetail without Supabase env: the demo session still opens for anyone; any other id is not found', { skip: supabaseConfigured && 'Supabase env is set' }, async () => {
    const demo = await getSessionDetail(DEMO_SESSION_ID);
    assert.equal(demo?.session.id, DEMO_SESSION_ID);
    assert.equal(demo?.session.team_id, DEMO_TEAM_ID);
    assert.ok(demo && demo.songs.length > 0);
    const member = { user, membershipOf: () => leader };
    assert.equal((await getSessionDetail(DEMO_SESSION_ID, { user: null, membershipOf: () => null }))?.session.id, DEMO_SESSION_ID);
    assert.equal(await getSessionDetail('6f1c2f8e-0000-4000-8000-000000000001', member), null);
    assert.equal(await getSessionDetail('prototype-set-1', member), null);
    assert.equal(await getSessionDetail('6f1c2f8e-0000-4000-8000-000000000001'), null);
});
