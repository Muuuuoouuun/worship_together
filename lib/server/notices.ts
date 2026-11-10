import { CONTI_CONFIRMED_TITLE, contiNotices } from '../contiNotices';
import { deadlineTargets, dueDeadlineNotices, type LibrarySetlistLike, type SetlistDetailsLike } from '../contiDeadline';
import { leaderIds, managerIds } from '../planning';
import { isPlaceholderMember } from '../../types/team';
import type { PlanningNotification } from '../../types/planning';
import type { TeamEvents } from './teamEvents';
import type { TeamRepository } from './teamRepository';
import type { TeamDocs, DocSavedHook } from './teamDocs';

/*
 * 새 알림을 받는 사람에게 보내는 한 곳.
 * 일정 명령 · 공지 · 콘티 확정이 만든 알림을 팀 소식(planning.notice, 받는 사람에게만)으로 흘려보내
 * 어느 화면에 있든 앱 알림 · 기기 알림이 뜨게 하고, 앱을 닫은 사람에게는 푸시를 보냅니다.
 */

export interface NoticePayload {
    id: string;
    teamId: string;
    title: string;
    body: string;
    urgent: boolean;
    target: PlanningNotification['target'];
    entityId: string;
    slotId: string | null;
    by: string;
}

export type NoticePush = (recipientIds: string[], notice: NoticePayload) => void;

export function deliverNotices(events: TeamEvents, teamId: string, created: PlanningNotification[], byId: string, push?: NoticePush | null, now = Date.now()) {
    // 알림 목록은 최신이 앞이므로, 만든 순서대로 보내려고 뒤집습니다.
    for (const item of [...created].reverse()) {
        // 밤 시간에 생긴 알림은 아침에 예약 알림 확인이 보냅니다 (앱 안 목록에는 이미 보임).
        if (item.deliverAt && Date.parse(item.deliverAt) > now) continue;
        const audience = item.recipientIds.filter((id) => !isPlaceholderMember(id));
        if (!audience.length) continue;
        const payload: NoticePayload = { id: item.id, teamId, title: item.title, body: item.body, urgent: item.urgent, target: item.target, entityId: item.entityId, slotId: item.slotId ?? null, by: byId };
        events.publish(teamId, 'planning.notice', payload, audience);
        try { push?.(audience, payload); } catch (error) { console.error('[notices] push', error); }
    }
}

const setlistDetailsPrefix = (teamId: string) => `worship:setlist-details:v1:${encodeURIComponent(teamId)}:`;
const libraryKey = (teamId: string) => `worship-together:library:v1:${encodeURIComponent(teamId)}`;
const parseJson = <T,>(json: string | null): T | null => {
    if (!json) return null;
    try { return JSON.parse(json) as T; } catch { return null; }
};
/** 팀 공유 자료의 콘티 목록과 콘티 세부 (마감 대상 계산용) */
function contiSources(docs: TeamDocs, teamId: string, library?: string | null) {
    const setlists = parseJson<{ setlists?: LibrarySetlistLike[] }>(library === undefined ? docs.raw(teamId, libraryKey(teamId)) : library)?.setlists ?? [];
    const detailsOf = (setlistId: string) => parseJson<SetlistDetailsLike>(docs.raw(teamId, `${setlistDetailsPrefix(teamId)}${encodeURIComponent(setlistId)}`));
    return { setlists, detailsOf };
}

/**
 * 콘티 마감 예약 알림 (서버가 1분마다). 팀마다 보낼 때가 된 마감 알림을 만들고,
 * 밤이라 미뤄 둔 알림까지 받는 사람에게 보냅니다.
 */
export function sweepDeadlines(teams: TeamRepository, docs: TeamDocs, events: TeamEvents, push?: () => NoticePush | null, now = Date.now()) {
    for (const teamId of teams.teamIds()) {
        try {
            const created = teams.sweepDeadlines(teamId, ({ state, members, policy }) => {
                const { setlists, detailsOf } = contiSources(docs, teamId);
                return dueDeadlineNotices({ events: state.events, setlists, detailsOf, members, state, now, managerIds: managerIds(members, policy), leaderIds: leaderIds(members) });
            }, now);
            if (!created.length) continue;
            events.publish(teamId, 'planning.changed', { by: 'system' });
            deliverNotices(events, teamId, created, 'system', push?.(), now);
        } catch (error) {
            console.error('[deadline] sweep', teamId, error);
        }
    }
}

/** 콘티가 저장되면 확정 · 변경 알림을 만듭니다 (lib/contiNotices). */
export function contiSaveHook(teams: TeamRepository, docs: TeamDocs, events: TeamEvents, push?: () => NoticePush | null): DocSavedHook {
    return ({ teamId, user, key, kind, before, after }) => {
        if (kind !== 'setlist-details' && kind !== 'library') return;
        const { state, members } = teams.planningSnapshot(teamId);
        const notices = contiNotices({
            kind,
            setlistId: kind === 'setlist-details' ? decodeURIComponent(key.slice(setlistDetailsPrefix(teamId).length)) : undefined,
            before,
            after,
            library: kind === 'library' ? after : docs.raw(teamId, libraryKey(teamId)),
            detailsOf: (setlistId) => docs.raw(teamId, `${setlistDetailsPrefix(teamId)}${encodeURIComponent(setlistId)}`),
            planning: state,
            members,
            editor: user,
        });
        // 확정되면 그 예배 콘티에 대한 요청(독촉)을 완료하고, 요청한 사람도 확정 알림을 받게 합니다.
        const confirmed = notices.find((item) => item.title === CONTI_CONFIRMED_TITLE);
        if (confirmed) {
            const { setlists, detailsOf } = contiSources(docs, teamId, kind === 'library' ? after : undefined);
            const keys = deadlineTargets({ events: state.events, setlists, detailsOf, members, state }).filter((target) => target.setlistId === confirmed.setlistId).map((target) => target.key);
            const authors = teams.resolveNudges(teamId, keys).filter((id) => id !== user.id);
            confirmed.recipientIds = [...new Set([...confirmed.recipientIds, ...authors])];
        }
        if (!notices.length) return;
        const created = teams.addNotices(teamId, notices.map((item) => ({ title: item.title, body: item.body, target: 'conti' as const, entityId: item.setlistId, recipientIds: item.recipientIds })));
        events.publish(teamId, 'planning.changed', { by: user.id });
        deliverNotices(events, teamId, created, user.id, push?.());
    };
}
