'use client';

import { useState } from 'react';
import { CUE_KIND_LABEL } from './CueIsland';
import type { LiveToast } from './model';

function describe(toast: LiveToast) {
    const who = toast.kind === 'cue-sent' ? '' : toast.from && toast.target ? `${toast.from}에서 ${toast.target}에게` : toast.from ?? '';
    return [CUE_KIND_LABEL[toast.kind], toast.title, toast.body, who].filter(Boolean).join(', ');
}

/**
 * 스크린리더 알림: 급한 큐와 오류는 role="alert", 나머지는 polite.
 * 새로 들어온 알림만 한 번 읽습니다 (닫혀서 다음 알림이 앞으로 올 때는 다시 읽지 않음).
 * 시트가 열려 뒤 화면이 inert 여도 읽히도록 화면 맨 바깥에 둡니다.
 */
export default function Announcer({ toasts }: { toasts: LiveToast[] }) {
    const [known, setKnown] = useState('');
    const [message, setMessage] = useState({ alert: '', polite: '' });
    const key = toasts.map((toast) => `${toast.id}${toast.acked ? '+' : ''}`).join(' ');
    if (key !== known) {
        const before = new Set(known.split(' '));
        const fresh = toasts.filter((toast) => !before.has(`${toast.id}${toast.acked ? '+' : ''}`));
        const urgent = fresh.find((toast) => !toast.acked && (toast.urgency === 'high' || toast.tone === 'danger'));
        const calm = fresh.find((toast) => toast.acked || !(toast.urgency === 'high' || toast.tone === 'danger'));
        setKnown(key);
        if (urgent || calm) {
            setMessage((current) => ({
                alert: urgent ? describe(urgent) : current.alert,
                polite: calm ? (calm.acked ? `${calm.title} 큐 확인함` : describe(calm)) : current.polite,
            }));
        }
    }
    return (
        <>
            <div role="alert" className="sr-only">
                {message.alert}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
                {message.polite}
            </div>
        </>
    );
}
