import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Sqlite from 'better-sqlite3';
import { TeamRepository } from '../lib/server/teamRepository';

const owner = { id: 'google-owner-identity', name: '인도자' };
const guest = { id: 'naver-member-identity', name: '팀원' };

test('a shareable invite joins the same persistent team from a second connection; repeated acceptance is idempotent', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'worship-invite-'));
    const file = path.join(folder, 'teams.sqlite');
    const first = new TeamRepository(file), second = new TeamRepository(file);
    try {
        const team = first.create('주일 예배팀', owner);
        const invitation = first.createInvite(team.id, owner.id);
        assert.equal(second.preview(invitation.token)?.teamName, '주일 예배팀');
        assert.deepEqual(second.list(guest.id), []);
        assert.equal(second.join(invitation.token, guest), team.id);
        second.join(invitation.token, guest);
        assert.equal(first.list(owner.id)[0].members.length, 2);
        assert.equal(second.list(guest.id)[0].id, team.id);
        first.assignRole(team.id, owner.id, guest.id, 'drums');
        assert.equal(second.list(guest.id)[0].members.find(m => m.userId === guest.id)?.role, 'drums');
        const raw = new Sqlite(file);
        assert.notEqual((raw.prepare('SELECT token_hash FROM online_invites').get() as { token_hash: string }).token_hash, invitation.token);
        raw.close();
    } finally { first.close(); second.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('invites grant membership only; members and unrelated users cannot invite or assign roles', () => {
    const repo = new TeamRepository(':memory:');
    try {
        const team = repo.create('팀', owner), link = repo.createInvite(team.id, owner.id);
        repo.join(link.token, guest);
        assert.throws(() => repo.createInvite(team.id, guest.id), /관리자/);
        assert.throws(() => repo.assignRole(team.id, guest.id, guest.id, 'leader'), /관리자/);
        assert.throws(() => repo.revokeInvites(team.id, 'intruder'), /접근/);
        repo.assignRole(team.id, owner.id, guest.id, 'leader');
        assert.throws(() => repo.createInvite(team.id, guest.id), /관리자/);
        assert.deepEqual(repo.list('intruder'), []);
    } finally { repo.close(); }
});

test('rotation and revocation invalidate previous tokens; malformed inputs never join', () => {
    const repo = new TeamRepository(':memory:');
    try {
        const team = repo.create('팀', owner), original = repo.createInvite(team.id, owner.id);
        const next = repo.createInvite(team.id, owner.id);
        assert.equal(repo.preview(original.token), null);
        assert.throws(() => repo.join(original.token, guest), /만료/);
        assert.equal(repo.preview("' OR 1=1 --"), null);
        repo.revokeInvites(team.id, owner.id);
        assert.throws(() => repo.join(next.token, guest), /만료/);
        assert.equal(repo.list(owner.id)[0].members.length, 1);
    } finally { repo.close(); }
});

test('expired invitations are rejected at acceptance, including previously previewed links', () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'worship-expiry-'));
    const file = path.join(folder, 'teams.sqlite'), repo = new TeamRepository(file);
    try {
        const team = repo.create('팀', owner), invite = repo.createInvite(team.id, owner.id);
        assert(repo.preview(invite.token));
        const raw = new Sqlite(file); raw.prepare('UPDATE online_invites SET expires_at = ?').run('2000-01-01T00:00:00.000Z'); raw.close();
        assert.equal(repo.preview(invite.token), null);
        assert.throws(() => repo.join(invite.token, guest), /만료/);
    } finally { repo.close(); rmSync(folder, { recursive: true, force: true }); }
});
