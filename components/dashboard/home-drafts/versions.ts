/*
 * 데스크톱 홈 화면 시안 목록 (/dashboard/home-drafts). 서버 컴포넌트에서 읽으므로 'use client' 파일과 분리합니다.
 */

export type HomeDraftId = '1' | '2' | '3';

export interface HomeDraftVersion {
    id: HomeDraftId;
    title: string;
    summary: string;
    points: string[];
}

export const HOME_DRAFTS: HomeDraftVersion[] = [
    {
        id: '1',
        title: '주간 보드',
        summary: '모바일 \'이번 주\' 화면을 넓게 편 홈. 위에 한 주 날짜 줄, 왼쪽에 민트 이번 주 콘티와 주일 일정, 오른쪽에 팀 소식과 확인할 요청.',
        points: ['모바일과 같은 순서 · 같은 블록을 두 단으로', '날짜 줄에서 고른 날의 일정과 팀 배치', '팀 소식 · 요청은 오른쪽에 늘 보임'],
    },
    {
        id: '2',
        title: '오늘 할 일',
        summary: '지금 내가 할 일부터 보여 주는 홈. 주일까지 남은 일을 날짜순 타임라인으로, 이번 주 콘티와 응답이 필요한 요청은 옆에.',
        points: ['인사와 함께 주일까지 남은 날 · 할 일 수', '연습 · 콘티 마감 · 예배를 한 줄 타임라인으로', '응답 필요한 요청을 바로 처리'],
    },
    {
        id: '3',
        title: '파스텔 타일',
        summary: '모바일의 파스텔 블록을 타일로 배치한 홈. 큰 민트 타일에 이번 주 콘티, 주변 타일에 다음 일정 · 요청 · 팀 소식 · 팀 배치 · 바로가기.',
        points: ['한눈에 보이는 이번 주 상태', '타일마다 하나의 색 · 하나의 일', '자주 쓰는 화면으로 바로 이동'],
    },
];

export const HOME_DRAFT_IDS = new Set<HomeDraftId>(HOME_DRAFTS.map((draft) => draft.id));
