import type { PulseDraftProps } from '../pulse/types';

export type FinalistId = 'a' | 'b';

/** 'main' = 기본 화면 (지금 카드·악보·콘솔), 'pulse' = 펄스 화면 */
export type FinalistView = 'main' | 'pulse';

export interface FinalistProps extends PulseDraftProps {
    /** 처음 보여 줄 화면. 시안 안에서 기본 ↔ 펄스를 오갈 수 있어야 합니다 */
    view?: FinalistView;
}
