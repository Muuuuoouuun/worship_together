import type { DraftToast } from './toastDemo';

export interface PulseDraftProps {
    /** 같은 시안을 데스크톱 틀과 휴대폰 틀에 각각 그립니다 */
    device: 'desktop' | 'mobile';
    /** 갤러리 틀 안에 들어갈 때 true (전체화면·잠금 같은 기기 동작은 흉내만 냅니다) */
    framed?: boolean;
    /** 떠 있는 알림. 0번이 가장 새 알림 */
    toasts: DraftToast[];
    onDismiss: (id: string) => void;
    /** 받은 큐 '확인' */
    onAck: (id: string) => void;
    /** 알림 버튼 (실행 취소 · 다시 시도 · 보기) */
    onAction: (id: string) => void;
    /** 시안 안에서 큐를 보냈을 때 — 보낸 큐 알림이 뜹니다 */
    onSendCue: (label: string, target: string) => void;
}
