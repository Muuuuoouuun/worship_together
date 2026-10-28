export type StageRealtimeStatus = 'idle' | 'connected' | 'reconnecting' | 'offline' | 'error';

export interface StageRealtimeStatusMeta {
    dot: string;
    label: string;
    tone: string;
}

/**
 * 무대 상단 연결 상태 알약. 오프라인/오류는 '같은 브라우저 탭' 전송 가능 여부보다 먼저 판단해
 * 기기가 끊긴 상태에서 '브라우저 탭' 으로 보이지 않게 합니다.
 */
export function getRealtimeStatusMeta(status: StageRealtimeStatus, localTransportAvailable: boolean): StageRealtimeStatusMeta {
    if (status === 'offline' || status === 'error') {
        return {
            dot: 'bg-red-400',
            label: '오프라인',
            tone: 'bg-red-400/[0.12] text-red-100',
        };
    }

    if (status !== 'connected' && localTransportAvailable) {
        return {
            dot: 'bg-white/45',
            label: '브라우저 탭',
            tone: 'bg-white/[0.08] text-white/60',
        };
    }

    switch (status) {
        case 'connected':
            return {
                dot: 'sync-pulse bg-emerald-400',
                label: '실시간',
                tone: 'bg-emerald-300/[0.12] text-emerald-100',
            };
        case 'reconnecting':
            return {
                dot: 'sync-pulse-warning bg-amber-300',
                label: '재연결',
                tone: 'bg-amber-300/[0.12] text-amber-100',
            };
        case 'idle':
        default:
            return {
                dot: 'bg-white/35',
                label: '대기',
                tone: 'bg-white/[0.08] text-white/60',
            };
    }
}

/** 오프라인일 때 큐 전달 문구 앞에 기기 상태를 붙입니다. 확인/실패/전송 중 문구는 그대로 둡니다. */
export function getOfflineCueLabel(label: string, status: StageRealtimeStatus): string {
    if (status !== 'offline') return label;
    if (label.endsWith('수신 미확인')) return '오프라인 · 수신 미확인';
    return `오프라인 · ${label}`;
}
