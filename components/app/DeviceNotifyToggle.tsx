'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { BellRing, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { deviceNotifyState, requestDeviceNotify, type DeviceNotifyState } from '@/lib/deviceNotify';
import { pushAvailable, syncPushSubscription } from '@/lib/pushClient';

const noop = () => () => {};

/**
 * 이 기기 알림 켜기. 허락하면 앱을 보고 있지 않을 때도 예배 시작 · 큐 · 팀 알림 · 공지를 알려 줍니다.
 * 서버에 푸시가 설정되어 있고 브라우저가 지원하면 앱을 닫아도 옵니다(아이폰은 홈 화면에 추가한 앱에서).
 */
export default function DeviceNotifyToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
    const initial = useSyncExternalStore(noop, deviceNotifyState, () => 'default' as DeviceNotifyState);
    const [asked, setAsked] = useState<DeviceNotifyState | null>(null);
    const [closedApp, setClosedApp] = useState(false);
    const state = asked ?? initial;
    useEffect(() => {
        let active = true;
        void pushAvailable().then((available) => { if (active) setClosedApp(available); });
        return () => { active = false; };
    }, []);
    if (state === 'unsupported') return null;
    const scope = '예배 시작 · 큐 · 팀 알림 · 공지';
    const text = state === 'granted'
        ? closedApp ? `앱을 닫아도 ${scope}를 알려 드려요.` : `앱을 보고 있지 않을 때도 ${scope}를 알려 드려요.`
        : state === 'denied'
            ? '브라우저 설정에서 이 사이트의 알림을 허용하면 켤 수 있어요.'
            : closedApp ? `앱을 닫아도 ${scope}를 알림으로 받아요.` : `다른 앱을 보고 있어도 ${scope}를 알림으로 받아요.`;
    async function turnOn() {
        const next = await requestDeviceNotify();
        setAsked(next);
        if (next === 'granted') await syncPushSubscription();
    }
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
                <Button type="button" size="sm" variant={state === 'denied' ? 'outline' : 'default'} disabled={state === 'denied'} onClick={() => void turnOn()}>
                    {state === 'denied' ? '차단됨' : '켜기'}
                </Button>
            )}
        </div>
    );
}
