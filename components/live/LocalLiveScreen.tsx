'use client';

import type { SessionDetail } from '@/types/session';
import LiveScreen from './LiveScreen';
import { useLocalLiveSession } from './useLocalLiveSession';

/** 이 기기에서만 진행하는 예배 — 서버 예배와 같은 화면 */
export default function LocalLiveScreen({ detail, loginHref }: { detail: SessionDetail; loginHref: string }) {
    const { model, handlers } = useLocalLiveSession(detail, { loginHref });
    return <LiveScreen model={model} handlers={handlers} />;
}
