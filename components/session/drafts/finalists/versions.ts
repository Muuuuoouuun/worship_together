/*
 * 예배 중 화면 최종 후보 2개 (비교 페이지 /session/drafts/compare).
 * 서버 컴포넌트에서 읽으므로 'use client' 파일과 분리합니다.
 */
import type { FinalistId } from './types';

export interface FinalistVersion {
    id: FinalistId;
    letter: 'A' | 'B';
    title: string;
    tone: '밝은 화면' | '무대용 어두운 화면';
    summary: string;
    /** 어떤 시안을 합쳤는지 */
    parts: { label: string; value: string }[];
}

export const FINALISTS: FinalistVersion[] = [
    {
        id: 'a',
        letter: 'A',
        title: '밝은 따라가기',
        tone: '밝은 화면',
        summary: '흰 바탕의 앱 화면 그대로 예배를 따라갑니다. 지금 섹션과 가사·코드가 주인공이고, 박자는 큰 숫자로, 큐는 위 · 앱 알림은 아래로 나뉩니다.',
        parts: [
            { label: '모바일', value: '지금 카드' },
            { label: '데스크톱', value: '악보 무대' },
            { label: '펄스', value: '숫자 박자' },
            { label: '알림', value: '위 아일랜드 · 아래 카드' },
        ],
    },
    {
        id: 'b',
        letter: 'B',
        title: '어두운 무대',
        tone: '무대용 어두운 화면',
        summary: '어두운 예배당 무대에 맞춘 화면. 악보와 콘솔이 화면을 채우고, 박자는 원형 링으로, 알림은 엄지 위 카드 스택으로 쌓입니다.',
        parts: [
            { label: '모바일', value: '악보 우선' },
            { label: '데스크톱', value: '진행 콘솔' },
            { label: '펄스', value: '원형 링' },
            { label: '알림', value: '카드 스택' },
        ],
    },
];

export interface CompareRow {
    criterion: string;
    a: string;
    b: string;
    /** 이 기준에서 더 나은 쪽 (비슷하면 null) */
    better: FinalistId | null;
}

/** 비교표 — 두 후보를 다 만든 뒤 채웁니다 */
export const COMPARE_ROWS: CompareRow[] = [];

export const RECOMMENDATION: { pick: FinalistId | null; reason: string } = { pick: null, reason: '' };
