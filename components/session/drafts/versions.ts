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
        summary: '가운데 큰 코드 차트와 오른쪽 진행 레일. 모든 팀원이 같은 화면으로 인도자를 따라가고, 아래 막대에서 넘김과 큐를 보냅니다.',
        points: ['위 한 줄에 곡 · 키 · BPM 박자 점 · 따라가는 중', '오른쪽 레일에 크게 쓴 지금 섹션 · 다음 · 곡 메모 · 송폼 · 콘티 순서', '다음 버튼에 갈 곳 표시, 흐름 큐와 받은 큐 알림은 아래 막대에'],
        tone: '밝은 화면',
    },
    {
        id: 'desktop-b',
        device: 'desktop',
        letter: 'B',
        title: '진행 콘솔',
        summary: '인도자·음향석을 위한 3단 콘솔. 순서·팀 접속 — 지금 — 큐를 한눈에 보고 바로 신호를 보냅니다.',
        points: ['가운데 아주 큰 현재 섹션과 4박 표시, 다음 섹션 · 곡 메모', '송폼 타임라인과 큰 이전/다음 버튼으로 바로 이동', '그룹별 큐를 바로 보내고 최근 큐에서 팀원 확인 상태 확인'],
        tone: '무대용 어두운 화면',
    },
    {
        id: 'mobile-a',
        device: 'mobile',
        letter: 'A',
        title: '지금 카드',
        summary: '한 손으로 따라가는 화면. 가운데 지금 카드에 현재 섹션 · 가사 · 코드를 크게, 바로 아래 다음 섹션을 두고 넘김과 큐는 엄지 자리에 모았습니다.',
        points: ['지금 카드에 현재 섹션 · 가사 첫 줄 · 코드, 바로 아래 다음 섹션', '엄지 자리에 송폼 · 이전/다음 섹션 · 큐, 맨 아래 악보 · 순서', '큐는 받는 사람별 바텀시트로, 기기 설정 · 팀 접속은 더보기 시트로'],
        tone: '밝은 화면',
        altLabel: '큐 보내기 시트',
    },
    {
        id: 'mobile-b',
        device: 'mobile',
        letter: 'B',
        title: '악보 우선',
        summary: '화면 전체가 코드 차트. 위아래 얇은 막대에 곡 정보와 넘김만 두고, 송폼·순서와 큐는 아래에서 올라오는 시트로 엽니다.',
        points: ['지금 섹션은 흰 알약과 띠로, 다음 섹션에는 \'다음\' 표시', '위 막대에 곡 · 키 · 박자 점 · BPM, 아래 막대에 이전 · 다음', '송폼 · 콘티 순서와 큐는 시트로, 놓친 지금 섹션은 한 번에 복귀'],
        tone: '무대용 어두운 화면',
        altLabel: '송폼 · 순서 시트',
    },
];

export const DRAFT_VERSION_IDS = new Set<DraftVersionId>(DRAFT_VERSIONS.map((version) => version.id));
