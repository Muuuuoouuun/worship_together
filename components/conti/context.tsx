'use client';

import { createContext, useContext } from 'react';
import type { ContiSetlist } from './model';
import type { PlanningView } from './planningBridge';

/** 순서 화면에서 곡 하나를 편집할 때의 값 */
export interface SongDraft {
    key: string;
    bpm: string;
    lead: string;
    form: string[];
    notes: string;
    /** 이 곡에서 다음 곡으로 넘어갈 때의 메모 */
    transition: string;
    video: string;
    sheet: string;
    mr: string;
}

/** 순서 화면 편집 모드 전체 값. 곡 값은 곡 보관함 곡 id 기준입니다. */
export interface SetlistDraft {
    owner: string;
    status: 'writing' | 'confirmed';
    order: string[];
    songs: Record<string, SongDraft>;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** 실제 데이터가 연결된 화면에서만 제공됩니다. 시안 화면에서는 null (읽기 전용). */
export interface ContiEditor {
    /** 서버 저장 콘티는 아직 순서 변경을 지원하지 않습니다. */
    canReorder: boolean;
    /** 팀 권한상 콘티를 고칠 수 있는지 (false 면 보기 · 코멘트만). 없으면 true */
    canEdit?: boolean;
    /** 저장 위치 안내 (예: '이 브라우저에 저장돼요') */
    storageNote: string;
    /** 새 콘티를 만드는 곳 */
    createHref: string;
    /** 라이브 예배 화면 주소 */
    sessionHref?: (setlistId: string) => string;
    saveSetlist: (setlistId: string, draft: SetlistDraft) => SaveResult;
    addComment: (setlistId: string, songId: string, text: string) => SaveResult;
}

export interface ContiData {
    /** 오늘 날짜 YYYY-MM-DD (서울 기준) */
    today: string;
    setlists: ContiSetlist[];
    /** 이번 주(다가오는) 콘티 */
    thisWeekId: string | null;
    editor: ContiEditor | null;
    /** 담당자·리드 입력 추천 이름 */
    roster: string[];
    /** 팀 배치·일정·요청·팀 소식 (일정·요청 화면과 같은 데이터) */
    planning: PlanningView;
}

const ContiContext = createContext<ContiData | null>(null);

export const ContiProvider = ContiContext.Provider;

export function useConti(): ContiData {
    const value = useContext(ContiContext);
    if (!value) throw new Error('ContiProvider 안에서만 사용할 수 있습니다.');
    return value;
}
