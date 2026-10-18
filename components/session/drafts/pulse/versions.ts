/*
 * 펄스 · 앱 알림(토스트) 시안 목록. 서버 컴포넌트(갤러리)에서 읽으므로 'use client' 파일과 분리합니다.
 */

export type PulseDraftId = '1' | '2' | '3';

export interface PulseDraftVersion {
    id: PulseDraftId;
    title: string;
    tone: '밝은 화면' | '무대용 어두운 화면';
    pulse: string;
    toast: string;
    points: string[];
}

export const PULSE_DRAFTS: PulseDraftVersion[] = [
    {
        id: '1',
        title: '숫자 박자',
        tone: '밝은 화면',
        pulse: '아주 큰 박 숫자와 한 줄 박 막대. 센박은 검정 알약으로, 마디 진행은 아래 얇은 선으로.',
        toast: '연주에 관한 큐는 위 가운데 알약(아일랜드)에서 커졌다 줄고, 저장·오류 같은 앱 알림은 아래 가운데에.',
        points: ['박 숫자 · 박자표 · 마디 n/8 을 한눈에', '큐는 위, 앱 알림은 아래 — 자리만 봐도 종류를 압니다', '여러 개가 오면 한 줄로 접고 +2 로 표시'],
    },
    {
        id: '2',
        title: '원형 링',
        tone: '무대용 어두운 화면',
        pulse: '박 수만큼 나뉜 원형 링이 한 칸씩 켜지고, 가운데 원이 박마다 숨 쉬듯 커집니다. 바깥 얇은 링은 섹션 진행.',
        toast: '알림은 엄지 위(모바일) · 오른쪽 아래(데스크톱)에 카드로 쌓이고, 받은 큐는 카드에서 바로 확인.',
        points: ['링 칸 = 박, 바깥 링 = 섹션 진행, 가운데 = 지금 섹션', '카드 왼쪽 색 띠로 큐 · 연결 · 앱 알림 구분', '남은 시간 막대와 확인 버튼, 뒤 카드는 겹쳐 보임'],
    },
    {
        id: '3',
        title: '무대 플래시',
        tone: '무대용 어두운 화면',
        pulse: '화면 가장자리와 큰 박 칸이 박마다 번쩍여 뒷줄 드럼에서도 보입니다. 센박은 가장 밝게.',
        toast: '전체 큐는 잠깐 화면을 크게 덮었다가 옆 알림 레일로 접히고, 덜 급한 알림은 레일에만 쌓입니다.',
        points: ['멀리서도 보이는 박 칸과 가장자리 빛', '급한 큐는 크게 → 레일로 접힘, 나머지는 레일에', '레일에서 지난 알림 다시 보기 · 확인'],
    },
];

export const PULSE_DRAFT_IDS = new Set<PulseDraftId>(PULSE_DRAFTS.map((draft) => draft.id));
