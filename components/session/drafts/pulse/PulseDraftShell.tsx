'use client';

import { useCallback, type ReactNode } from 'react';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import PulseCount from './PulseCount';
import PulseRing from './PulseRing';
import PulseFlash from './PulseFlash';
import { TOAST_TRIGGERS, useToastDemo, type ToastKind } from './toastDemo';
import type { PulseDraftProps } from './types';
import type { PulseDraftId } from './versions';

const DRAFTS: Record<PulseDraftId, (props: PulseDraftProps) => ReactNode> = {
    '1': PulseCount,
    '2': PulseRing,
    '3': PulseFlash,
};

/**
 * 펄스 시안 하나 + 알림 데모 상태. 알림 보내 보기 버튼은 시안 화면 밖(틀 아래 또는 위 막대)에 둡니다.
 * - placement 'below': 갤러리 — frameClassName 틀 안에 시안, 그 아래 버튼 줄
 * - placement 'top'  : 한 화면 보기 — 위에 버튼 줄, 아래 시안이 남은 높이를 채움
 */
export default function PulseDraftShell({
    draft,
    device,
    framed = false,
    initialToasts = [],
    placement = 'below',
    frameClassName,
}: {
    draft: PulseDraftId;
    device: 'desktop' | 'mobile';
    framed?: boolean;
    initialToasts?: ToastKind[];
    placement?: 'below' | 'top';
    frameClassName?: string;
}) {
    const demo = useToastDemo(initialToasts);
    const { push } = demo;
    const Draft = DRAFTS[draft];
    const onSendCue = useCallback((label: string, target: string) => {
        push('cue-sent', { title: `보냄 · ${label}`, body: `${target}에게 보냈어요`, target });
    }, [push]);

    const screen = (
        <Draft
            device={device}
            framed={framed}
            toasts={demo.toasts}
            onDismiss={demo.dismiss}
            onAck={demo.ack}
            onAction={demo.act}
            onSendCue={onSendCue}
        />
    );

    const triggers = (
        <div className={cn('flex items-center gap-1.5 overflow-x-auto text-xs [scrollbar-width:none]', placement === 'top' ? 'h-11 shrink-0 border-b border-border bg-card px-2' : 'mt-4 flex-wrap justify-center')}>
            <span className="inline-flex shrink-0 items-center gap-1 px-1.5 text-muted-foreground">
                <BellRing size={13} aria-hidden="true" />
                알림 보내 보기
            </span>
            {TOAST_TRIGGERS.map((trigger) => (
                <button
                    key={trigger.kind}
                    type="button"
                    onClick={() => push(trigger.kind)}
                    className="h-8 shrink-0 rounded-full bg-card px-3 font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
                >
                    {trigger.label}
                </button>
            ))}
        </div>
    );

    if (placement === 'top') {
        return (
            <div className="flex h-full min-h-0 flex-col">
                {triggers}
                <div className="min-h-0 flex-1">{screen}</div>
            </div>
        );
    }

    return (
        <div>
            <div className={frameClassName}>{screen}</div>
            {triggers}
        </div>
    );
}
