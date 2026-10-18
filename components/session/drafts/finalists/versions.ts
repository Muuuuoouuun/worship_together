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

/** 비교표 — 두 후보를 같은 상태로 놓고 심사한 결과 */
export const COMPARE_ROWS: CompareRow[] = [
    { criterion: "멀리서 읽기 (보면대·드럼석 거리)", a: "펄스의 아주 큰 박 숫자와 데스크톱 코드 차트는 멀리서도 잘 보이지만, 폰의 코드 칩 글자는 조금 작아요.", b: "폰에서는 검은 바탕의 흰 코드가 가장 또렷하지만, 데스크톱 기본 화면에는 코드가 아예 없어요.", better: "a" },
    { criterion: "한 손 조작 (모바일)", a: "큐, 이전·다음, 화면 바꾸기가 모두 엄지 자리에 있고 '다음' 버튼이 넓어요.", b: "큐, 이전, 송폼, 다음은 아래에 있지만 악보·펄스 전환은 맨 위라 손이 잘 안 닿아요.", better: "a" },
    { criterion: "빠른 큐 보내기", a: "늘 보이는 버튼 3개를 누르면 바로 가고, 1.2초 초록 '보냄'과 위쪽 알약으로 확인돼요.", b: "같은 버튼 3개가 바로 가고, '보냄' 카드에 확인한 인원 점(4/6)까지 보여요.", better: null },
    { criterion: "BPM · 박자 보기", a: "박마다 점이 옮겨 가고 펄스는 큰 숫자로 세지만, 밝은 화면에서는 1박 초록이 검정과 거의 같아요.", b: "박마다 숫자가 뛰고 1박에 민트로 반짝이며, 데스크톱은 1·2·3·4 큰 칸이 켜져서 가장 잘 보여요.", better: "b" },
    { criterion: "지금 할 일에 집중 (정보 양)", a: "지금 섹션 카드 하나와 다음 섹션만 보여 줘서 군더더기가 적어요.", b: "폰은 악보 위주라 괜찮지만, 데스크톱은 순서·팀·큐 기록까지 한꺼번에 보여서 연주자에게는 많아요.", better: "a" },
    { criterion: "알림 알아보기와 방해 정도", a: "큐가 위의 검정 아일랜드에 떠서 바로 보이지만, 펼쳐진 3초 동안 폰에서는 BPM 줄을, 데스크톱에서는 지금 코드를 가려요.", b: "알림이 카드 한 곳에 모이고 화면이 비켜 줘서 악보와 박자를 가리지 않지만, 알림이 여럿이면 '+2' 뒤로 숨어요.", better: "b" },
    { criterion: "어두운 예배당 / 밝은 연습실", a: "앱 테마를 따라 둘 다 되지만, 밝은 테마 그대로면 어두운 예배당에서 눈부셔요.", b: "늘 어두워서 예배당에 딱 맞고, 밝은 연습실에서도 읽는 데 문제는 없어요.", better: "b" },
    { criterion: "앱 다른 화면과의 일관성", a: "흰 바탕, 검정 알약, 초록 강조, 민트 블록을 그대로 써서 앱의 다른 화면과 한 몸처럼 보여요.", b: "어두운 무대 전용 화면이라 다른 앱처럼 느껴져요 (SPEC은 무대 화면을 어둡게 두는 걸 허용).", better: "a" },
    { criterion: "인도자·음향석 작업", a: "데스크톱에는 송폼 이동과 최근 큐 한두 개뿐이라 팀 상황을 보기엔 부족해요.", b: "콘티 순서, 팀 접속, 사람별 큐 확인, BPM ± 조절까지 한 화면에서 다 돼요.", better: "b" },
];

export const RECOMMENDATION: { pick: FinalistId | null; reason: string } = { pick: "b", reason: "예배 중 화면은 어두운 예배당에서 쓰고, 큐가 올 때 악보와 박자를 가리면 안 되니까 B가 더 맞습니다. 사용자가 요청한 BPM 애니메이션도 B가 더 잘 보입니다. 1박에 민트로 반짝이고 데스크톱은 1·2·3·4 칸이 켜지며, 인도자·음향석 콘솔도 B에만 제대로 있습니다. 다만 B 데스크톱 기본 화면에는 코드가 없으니, A의 '악보 무대' 코드 차트를 B 데스크톱의 세 번째 화면(지금 | 악보 | 펄스)으로 가져오세요." };
