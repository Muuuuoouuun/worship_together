export interface DraftScreenProps {
    /** 갤러리 틀 안에 들어갈 때 true (전체화면·잠금 같은 기기 동작은 흉내만 냅니다) */
    framed?: boolean;
    /** 모바일 시안의 두 번째 상태 (예: 시트를 연 화면) 로 시작 */
    alt?: boolean;
}
