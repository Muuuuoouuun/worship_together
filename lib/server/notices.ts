import { contiNotices } from '../contiNotices';
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

export function deliverNotices(events: TeamEvents, teamId: string, created: PlanningNotification[], byId: string, push?: NoticePush | null) {
    // 알림 목록은 최신이 앞이므로, 만든 순서대로 보내려고 뒤집습니다.
    for (const item of [...created].reverse()) {
        const audience = item.recipientIds.filter((id) => !isPlaceholderMember(id));
        if (!audience.length) continue;
        const payload: NoticePayload = { id: item.id, teamId, title: item.title, body: item.body, urgent: item.urgent, target: item.target, entityId: item.entityId, slotId: item.slotId ?? null, by: byId };
        events.publish(teamId, 'planning.notice', payload, audience);
        try { push?.(audience, payload); } catch (error) { console.error('[notices] push', error); }
    }
}

const setlistDetailsPrefix = (teamId: string) => `worship:setlist-details:v1:${encodeURIComponent(teamId)}:`;
const libraryKey = (teamId: string) => `worship-together:library:v1:${encodeURIComponent(teamId)}`;

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
        if (!notices.length) return;
        const created = teams.addNotices(teamId, notices.map((item) => ({ title: item.title, body: item.body, target: 'conti' as const, entityId: item.setlistId, recipientIds: item.recipientIds })));
        events.publish(teamId, 'planning.changed', { by: user.id });
        deliverNotices(events, teamId, created, user.id, push?.());
    };
}
