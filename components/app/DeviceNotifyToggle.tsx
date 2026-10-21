'use client';

import { useState, useSyncExternalStore } from 'react';
import { BellRing, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { deviceNotifyState, requestDeviceNotify, type DeviceNotifyState } from '@/lib/deviceNotify';

const noop = () => () => {};

/** 이 기기 알림 켜기 — 앱을 보고 있지 않을 때도 예배 시작 · 받은 큐를 알려 줍니다. */
export default function DeviceNotifyToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
    const initial = useSyncExternalStore(noop, deviceNotifyState, () => 'default' as DeviceNotifyState);
    const [asked, setAsked] = useState<DeviceNotifyState | null>(null);
    const state = asked ?? initial;
    if (state === 'unsupported') return null;
    const text = state === 'granted'
        ? '앱을 보고 있지 않을 때도 예배 시작 · 받은 큐를 알려 드려요.'
        : state === 'denied'
            ? '브라우저 설정에서 이 사이트의 알림을 허용하면 켤 수 있어요.'
            : '다른 앱을 보고 있어도 예배 시작 · 받은 큐를 알림으로 받아요.';
    return (
        <div className={cn('flex items-center gap-3', className)}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                <BellRing className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-foreground">이 기기 알림</p>
                {compact ? null : <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>}
            </div>
            {state === 'granted' ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                    <Check className="size-3" aria-hidden="true" />
                    켜짐
                </span>
            ) : (
                <Button type="button" size="sm" variant={state === 'denied' ? 'outline' : 'default'} disabled={state === 'denied'} onClick={() => void requestDeviceNotify().then(setAsked)}>
                    {state === 'denied' ? '차단됨' : '켜기'}
                </Button>
            )}
        </div>
    );
}
