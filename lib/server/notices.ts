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

/**
 * 알림마다 따로 보냅니다. 한 알림의 소식(planning.notice) 저장이 실패해도(잠금 충돌 등)
 * 그 알림의 푸시와 뒤따르는 알림은 그대로 나갑니다 — 열린 화면은 알림 배지의 주기 확인으로 따라잡습니다.
 */
export function deliverNotices(events: Pick<TeamEvents, 'publish'>, teamId: string, created: PlanningNotification[], byId: string, push?: NoticePush | null) {
    // 알림 목록은 최신이 앞이므로, 만든 순서대로 보내려고 뒤집습니다.
    for (const item of [...created].reverse()) {
        const audience = item.recipientIds.filter((id) => !isPlaceholderMember(id));
        if (!audience.length) continue;
        const payload: NoticePayload = { id: item.id, teamId, title: item.title, body: item.body, urgent: item.urgent, target: item.target, entityId: item.entityId, slotId: item.slotId ?? null, by: byId };
        try { events.publish(teamId, 'planning.notice', payload, audience); } catch (error) { console.error('[notices] publish', item.id, error); }
        try { push?.(audience, payload); } catch (error) { console.error('[notices] push', item.id, error); }
    }
}

const setlistDetailsPrefix = (teamId: string) => `worship:setlist-details:v1:${encodeURIComponent(teamId)}:`;
const libraryKey = (teamId: string) => `worship-together:library:v1:${encodeURIComponent(teamId)}`;

/** 콘티가 저장되면 확정 · 변경 알림을 만듭니다 (lib/contiNotices). */
export function contiSaveHook(teams: TeamRepository, docs: TeamDocs, events: Pick<TeamEvents, 'publish'>, push?: () => NoticePush | null): DocSavedHook {
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
        // 알림은 이미 저장됐습니다. 화면 새로고침 소식이 실패해도 알림 · 푸시는 보냅니다.
        try { events.publish(teamId, 'planning.changed', { by: user.id }); } catch (error) { console.error('[notices] planning.changed', error); }
        deliverNotices(events, teamId, created, user.id, push?.());
    };
}
