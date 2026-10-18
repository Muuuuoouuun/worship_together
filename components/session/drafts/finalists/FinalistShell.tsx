'use client';

import { useCallback, type ReactNode } from 'react';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinalistLight from './FinalistLight';
import FinalistStage from './FinalistStage';
import { TOAST_TRIGGERS, useToastDemo, type ToastKind } from '../pulse/toastDemo';
import type { FinalistId, FinalistProps, FinalistView } from './types';

const SCREENS: Record<FinalistId, (props: FinalistProps) => ReactNode> = {
    a: FinalistLight,
    b: FinalistStage,
};

const LABEL: Record<FinalistId, string> = { a: 'A · 밝은 따라가기', b: 'B · 어두운 무대' };

/**
 * 최종 후보를 같은 알림 상태로 함께 그립니다. 버튼 한 번에 두 후보에 같은 알림이 떠서 나란히 비교할 수 있습니다.
 * - layout 'row'   : 휴대폰 틀 두 개를 나란히 (frameClassName 이 각 틀)
 * - layout 'stack' : 데스크톱 틀을 위아래로
 * - layout 'single': 한 화면 보기 — 위에 버튼 줄, 아래 후보 하나가 남은 높이를 채움
 */
export default function FinalistShell({
    ids,
    device,
    view = 'main',
    framed = false,
    initialToasts = [],
    layout,
    frameClassName,
    caption,
}: {
    ids: FinalistId[];
    device: 'desktop' | 'mobile';
    view?: FinalistView;
    framed?: boolean;
    initialToasts?: ToastKind[];
    layout: 'row' | 'stack' | 'single';
    frameClassName?: string;
    /** 각 틀 아래에 붙는 설명 (예: '기본 화면') */
    caption?: string;
}) {
    const demo = useToastDemo(initialToasts);
    const { push } = demo;
    const onSendCue = useCallback((label: string, target: string) => {
        push('cue-sent', { title: `보냄 · ${label}`, body: `${target}에게 보냈어요`, target });
    }, [push]);

    const render = (id: FinalistId) => {
        const Screen = SCREENS[id];
        return (
            <Screen
                device={device}
                view={view}
                framed={framed}
                toasts={demo.toasts}
                onDismiss={demo.dismiss}
                onAck={demo.ack}
                onAction={demo.act}
                onSendCue={onSendCue}
            />
        );
    };

    const triggers = (
        <div className={cn('flex items-center gap-1.5 overflow-x-auto text-xs [scrollbar-width:none]', layout === 'single' ? 'h-11 shrink-0 border-b border-border bg-card px-2' : 'mt-5 flex-wrap justify-center')}>
            <span className="inline-flex shrink-0 items-center gap-1 px-1.5 text-muted-foreground">
                <BellRing size={13} aria-hidden="true" />
                {ids.length > 1 ? '두 후보에 같이 보내기' : '알림 보내 보기'}
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

    if (layout === 'single') {
        return (
            <div className="flex h-full min-h-0 flex-col">
                {triggers}
                <div className="min-h-0 flex-1">{render(ids[0])}</div>
            </div>
        );
    }

    return (
        <div>
            <div className={cn(layout === 'row' ? 'flex justify-center gap-12' : 'space-y-10')}>
                {ids.map((id) => (
                    <figure key={id} className={layout === 'row' ? undefined : 'w-full'}>
                        <figcaption className="mb-3 flex items-baseline justify-between gap-3 px-1 text-sm">
                            <span className="font-semibold text-foreground">{LABEL[id]}</span>
                            {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
                        </figcaption>
                        <div className={frameClassName}>{render(id)}</div>
                    </figure>
                ))}
            </div>
            {triggers}
        </div>
    );
}
