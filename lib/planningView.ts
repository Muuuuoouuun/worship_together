/**
 * 일정 화면의 "나의 다가오는 섬김" 카드가 쓰는 순수 계산.
 * React·서버 의존이 없어 단위 테스트로 바로 확인합니다.
 */
import type { ScheduleSlot } from '@/types/planning';

export type DutyAttendance = ScheduleSlot['attendance'];
/** 시작 시각 순으로 정렬된 내 배정 한 건 (event·slot 등 나머지 필드는 그대로 통과) */
export type DutyItem = { slot: { attendance: DutyAttendance } };

/** 카드에 찍는 실제 참석 상태 문구 */
export const DUTY_STATE_LABEL: Record<DutyAttendance, string> = {
    confirmed: '확정됨',
    pending: '응답 대기',
    absent: '불참',
};

/**
 * 가장 가까운 "섬길" 사역을 고릅니다. 입력은 시작 시각 순 정렬을 가정합니다.
 * 확정된 사역 중 가장 이른 것 → 없으면 응답 대기 중 가장 이른 것. 불참은 절대 고르지 않습니다.
 */
export function pickNextDuty<T extends DutyItem>(items: readonly T[]): T | undefined {
    return items.find(item => item.slot.attendance === 'confirmed')
        ?? items.find(item => item.slot.attendance === 'pending');
}

export type DutySummary = {
    total: number;
    confirmed: number;
    pending: number;
    absent: number;
    /** 머리글 오른쪽 상태 문구 (배정이 없으면 null) */
    label: string | null;
    tone: 'pending' | 'ok' | 'absent' | 'none';
};

/** 내 배정 상태 개수와 머리글 문구. 불참만 있을 때 "모두 확정됨"이라고 하지 않습니다. */
export function summarizeMyDuties(items: readonly DutyItem[]): DutySummary {
    let confirmed = 0, pending = 0, absent = 0;
    for (const { slot } of items) {
        if (slot.attendance === 'confirmed') confirmed++;
        else if (slot.attendance === 'pending') pending++;
        else absent++;
    }
    const total = items.length;
    if (pending > 0) return { total, confirmed, pending, absent, label: `응답 필요 ${pending}건`, tone: 'pending' };
    if (total === 0) return { total, confirmed, pending, absent, label: null, tone: 'none' };
    if (absent === 0) return { total, confirmed, pending, absent, label: '모두 확정됨', tone: 'ok' };
    if (confirmed === 0) return { total, confirmed, pending, absent, label: absent > 1 ? `불참 응답함 ${absent}건` : '불참 응답함', tone: 'absent' };
    return { total, confirmed, pending, absent, label: `확정 ${confirmed}건 · 불참 ${absent}건`, tone: 'ok' };
}
