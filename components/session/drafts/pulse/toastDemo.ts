'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * 앱 알림(토스트) 시안이 함께 쓰는 알림 목록과 데모 상태.
 * 세 시안은 같은 알림을 각자의 모양으로 그립니다 — 무엇을 보여 줄지는 여기, 어떻게 보일지는 시안 파일.
 */

export type ToastKind = 'cue-all' | 'cue-role' | 'cue-sent' | 'offline' | 'online' | 'saved' | 'error' | 'team';

/** 무슨 성격의 알림인지 — 색과 아이콘을 고를 때 씁니다 */
export type ToastTone = 'cue' | 'success' | 'warning' | 'danger' | 'info';

/** high = 지금 연주에 영향 (바로 보여야 함), normal = 내 역할 관련, low = 앱 일반 */
export type ToastUrgency = 'high' | 'normal' | 'low';

export interface DraftToast {
    id: string;
    kind: ToastKind;
    tone: ToastTone;
    urgency: ToastUrgency;
    title: string;
    body?: string;
    /** 보낸 사람 (큐·팀 소식) */
    from?: string;
    /** 받는 대상 표시 ('전체', '음향' …) */
    target?: string;
    /** 버튼 하나 (실행 취소, 다시 시도, 보기) */
    action?: string;
    /** 받은 큐처럼 '확인'을 누를 수 있는 알림 */
    ackable?: boolean;
    acked?: boolean;
    /** 보낸 큐의 확인 현황 '4/6' */
    progress?: { done: number; total: number };
    /** 같은 group 의 새 알림은 이전 것을 대신합니다 (연결 끊김 → 다시 연결됨) */
    group?: string;
    /** 자동으로 사라질 때까지 ms. null 이면 사용자가 닫을 때까지 */
    ttl: number | null;
    createdAt: number;
}

type ToastTemplate = Omit<DraftToast, 'id' | 'createdAt'>;

export const TOAST_TEMPLATES: Record<ToastKind, ToastTemplate> = {
    'cue-all': {
        kind: 'cue-all', tone: 'cue', urgency: 'high',
        title: '다음 섹션', body: 'Verse 2로 넘어갑니다', from: '김하늘', target: '전체',
        ackable: true, ttl: 6000,
    },
    'cue-role': {
        kind: 'cue-role', tone: 'cue', urgency: 'normal',
        title: '보컬 UP', body: '보컬 마이크를 조금 올려 주세요', from: '김하늘', target: '음향',
        ackable: true, ttl: 5000,
    },
    'cue-sent': {
        kind: 'cue-sent', tone: 'success', urgency: 'low',
        title: '보냄 · 한 번 더', body: '전체에게 보냈어요', target: '전체',
        progress: { done: 4, total: 6 }, ttl: 3500,
    },
    offline: {
        kind: 'offline', tone: 'warning', urgency: 'normal', group: 'connection',
        title: '연결이 끊겼어요', body: '다시 연결하는 중 · 화면은 계속 볼 수 있어요',
        ttl: null,
    },
    online: {
        kind: 'online', tone: 'success', urgency: 'low', group: 'connection',
        title: '다시 연결됐어요', body: '놓친 큐 1개를 받았어요',
        ttl: 3000,
    },
    saved: {
        kind: 'saved', tone: 'info', urgency: 'low',
        title: '콘티를 저장했어요', action: '실행 취소',
        ttl: 4000,
    },
    error: {
        kind: 'error', tone: 'danger', urgency: 'normal',
        title: '저장하지 못했어요', body: '네트워크를 확인해 주세요', action: '다시 시도',
        ttl: null,
    },
    team: {
        kind: 'team', tone: 'info', urgency: 'low',
        title: '이은혜님이 대타를 요청했어요', body: '10월 25일 주일 2부 · 건반', from: '이은혜', action: '보기',
        ttl: 5000,
    },
};

/** 데모 버튼에 쓰는 이름 */
export const TOAST_TRIGGERS: { kind: ToastKind; label: string }[] = [
    { kind: 'cue-all', label: '받은 큐 · 전체' },
    { kind: 'cue-role', label: '받은 큐 · 내 역할' },
    { kind: 'cue-sent', label: '보낸 큐' },
    { kind: 'offline', label: '연결 끊김' },
    { kind: 'online', label: '다시 연결' },
    { kind: 'saved', label: '저장 · 실행 취소' },
    { kind: 'error', label: '오류' },
    { kind: 'team', label: '팀 소식' },
];

export const MAX_VISIBLE_TOASTS = 3;

export interface ToastDemo {
    /** 새 알림이 앞(0번)에 옵니다. 최대 MAX_VISIBLE_TOASTS 개 */
    toasts: DraftToast[];
    push: (kind: ToastKind, overrides?: Partial<ToastTemplate>) => void;
    dismiss: (id: string) => void;
    /** 받은 큐 '확인' — 잠깐 확인 표시를 보여 준 뒤 닫힙니다 */
    ack: (id: string) => void;
    /** 알림의 버튼(실행 취소·다시 시도·보기)을 눌렀을 때 */
    act: (id: string) => void;
}

/**
 * @param initial 처음부터 떠 있을 알림 (시안 스크린샷용). 이 알림들은 사용자가 닫을 때까지 남습니다.
 */
export function useToastDemo(initial: ToastKind[] = []): ToastDemo {
    const seq = useRef(0);
    const [toasts, setToasts] = useState<DraftToast[]>(() =>
        initial.map((kind, index) => ({ ...TOAST_TEMPLATES[kind], id: `initial-${index}`, createdAt: 0, ttl: null })),
    );
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: string) => {
        const timer = timers.current.get(id);
        if (timer) clearTimeout(timer);
        timers.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const schedule = useCallback((id: string, ms: number) => {
        const previous = timers.current.get(id);
        if (previous) clearTimeout(previous);
        timers.current.set(id, setTimeout(() => dismiss(id), ms));
    }, [dismiss]);

    const push = useCallback((kind: ToastKind, overrides: Partial<ToastTemplate> = {}) => {
        seq.current += 1;
        const toast: DraftToast = { ...TOAST_TEMPLATES[kind], ...overrides, id: `${kind}-${seq.current}`, createdAt: Date.now() };
        setToasts((current) => {
            const rest = toast.group ? current.filter((item) => item.group !== toast.group) : current;
            return [toast, ...rest].slice(0, MAX_VISIBLE_TOASTS);
        });
        if (toast.ttl) schedule(toast.id, toast.ttl);
    }, [schedule]);

    const ack = useCallback((id: string) => {
        setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, acked: true } : toast)));
        schedule(id, 900);
    }, [schedule]);

    const act = useCallback((id: string) => {
        dismiss(id);
    }, [dismiss]);

    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach((timer) => clearTimeout(timer));
    }, []);

    return { toasts, push, dismiss, ack, act };
}
