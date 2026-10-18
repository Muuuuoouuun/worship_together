/*
 * '예배 중' 화면 디자인 시안 목록 (갤러리 /session/drafts 와 단일 화면 ?v= 에서 함께 씀).
 * 서버 컴포넌트에서 읽으므로 'use client' 파일과 분리해 둡니다.
 */

export type DraftVersionId = 'desktop-a' | 'desktop-b' | 'mobile-a' | 'mobile-b';

export interface DraftVersion {
    id: DraftVersionId;
    device: 'desktop' | 'mobile';
    /** 'A' | 'B' */
    letter: string;
    title: string;
    summary: string;
    points: string[];
    /** 시안의 기본 화면 톤 */
    tone: '밝은 화면' | '무대용 어두운 화면';
    /** 모바일 시안은 두 번째 상태도 함께 보여 줍니다 */
    altLabel?: string;
}

export const DRAFT_VERSIONS: DraftVersion[] = [
    {
        id: 'desktop-a',
        device: 'desktop',
        letter: 'A',
        title: '악보 무대',
        summary: '가운데 큰 악보(코드 차트)와 오른쪽 진행 레일. 모든 팀원이 같은 화면을 보며 인도자를 따라갑니다.',
        points: ['상단 한 줄에 곡 · 키 · BPM · 박자 · 동기화', '오른쪽 레일에 송폼과 콘티 순서', '아래 큐 바에서 역할별 큐를 한 번에'],
        tone: '밝은 화면',
    },
    {
        id: 'desktop-b',
        device: 'desktop',
        letter: 'B',
        title: '진행 콘솔',
        summary: '인도자·음향석을 위한 3단 콘솔. 순서 — 지금 — 큐·팀 접속을 한눈에 보고 바로 신호를 보냅니다.',
        points: ['가운데 아주 큰 현재 섹션과 박자 표시', '송폼 타임라인에서 바로 섹션 이동', '큐를 그룹별로 보내고 팀원 확인 상태 확인'],
        tone: '무대용 어두운 화면',
    },
    {
        id: 'mobile-a',
        device: 'mobile',
        letter: 'A',
        title: '지금 카드',
        summary: '한 손으로 쓰는 팔로우 화면. 지금 섹션과 다음 섹션을 크게, 넘김과 큐는 엄지가 닿는 아래에 둡니다.',
        points: ['현재 섹션 · 다음 섹션 · 가사 첫 줄을 크게', '아래쪽에 이전/다음 섹션과 큐 버튼', '큐 보내기는 바텀시트로'],
        tone: '밝은 화면',
        altLabel: '큐 보내기 시트',
    },
    {
        id: 'mobile-b',
        device: 'mobile',
        letter: 'B',
        title: '악보 우선',
        summary: '화면 전체가 악보. 위아래 얇은 막대에만 곡 정보와 넘김을 두고, 송폼·순서는 시트로 엽니다.',
        points: ['코드 차트를 화면 가득, 현재 섹션 강조', '위 막대에 곡 · 키 · 박자 점, 아래 막대에 넘김', '송폼 · 콘티 순서는 아래에서 올라오는 시트'],
        tone: '무대용 어두운 화면',
        altLabel: '송폼 · 순서 시트',
    },
];

export const DRAFT_VERSION_IDS = new Set<DraftVersionId>(DRAFT_VERSIONS.map((version) => version.id));
