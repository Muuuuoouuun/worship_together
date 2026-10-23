'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import Announcer from './Announcer';
import styles from './live-stage.module.css';
import { derivePosition, splitToasts } from './derive';
import { useDeviceToggles, useIsDesktop, useToastExpiry } from './hooks';
import LiveDesktop from './LiveDesktop';
import LiveEnded, { LiveEmpty } from './LiveEnded';
import LiveMobile, { type LiveView } from './LiveMobile';
import type { LiveScreenHandlers, LiveScreenModel } from './model';

/*
 * 예배 중 화면 — 지금 · 악보 · 차분한 펄스. 모델(LiveScreenModel)만 보고 그리고, 움직임은 모두 handlers 로 보냅니다.
 * - lg 미만: 모바일 배치(LiveMobile) · lg 이상: 데스크톱 배치(LiveDesktop). 화면(지금 · 악보 · 펄스)과 잠금은 두 배치가 함께 씁니다.
 * - 연주 큐는 위 가운데 아일랜드, 앱 알림은 넘김 버튼 위 카드 줄. ttl 이 지난 알림은 여기서 handlers.dismiss 로 닫습니다.
 * - 예배를 마치면(ended) 조작 없는 끝 화면만 보여 줍니다.
 * 지금 · 악보는 앱 테마를 따르고, 펄스는 이 화면 안에서만 차콜 색상을 사용합니다.
 */

export default function LiveScreen({ model, handlers, className }: { model: LiveScreenModel; handlers: LiveScreenHandlers; /** 바깥 틀 안에 넣을 때 높이 등을 바꿉니다 (기본 h-dvh) */ className?: string }) {
    const desktop = useIsDesktop();
    const [view, setView] = useState<LiveView>('now');
    const device = useDeviceToggles(!model.ended);
    useToastExpiry(model.toasts, handlers.dismiss);

    // 한국어는 낱말 중간에서 줄을 바꾸지 않게 (넘칠 만큼 긴 낱말만 끊음)
    const shell = cn('relative h-dvh w-full overflow-hidden bg-background text-foreground [overflow-wrap:break-word] [word-break:keep-all]', className);
    const pos = derivePosition(model);

    if (model.ended) {
        return (
            <div className={shell}>
                <LiveEnded model={model} />
            </div>
        );
    }

    if (!pos) {
        return (
            <div className={shell}>
                <LiveEmpty model={model} handlers={handlers} />
            </div>
        );
    }

    const { cues, notices } = splitToasts(model.toasts);
    const layout = { model, handlers, pos, view, onView: setView, device, cues, notices, onSendCue: handlers.sendCue };

    return (
        <main className={cn(shell, styles.stage, view === 'pulse' && styles.pulse)} data-live-view={view}>
            <h1 className="sr-only">
                {model.title} · 예배 중
            </h1>
            {/* 서버 · 첫 그림에서는 화면 폭을 모르므로 빈 바탕만 — 엉뚱한 배치가 잠깐 보이지 않게 */}
            {desktop === null ? null : desktop ? <LiveDesktop {...layout} /> : <LiveMobile {...layout} />}
            <Announcer toasts={model.toasts} />
        </main>
    );
}
