'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, Radio, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { APP_TOAST_EVENT, type AppToastInput, type AppToastTone } from '@/lib/appToast';

interface Toast extends Required<Pick<AppToastInput, 'title'>> {
    id: string;
    group?: string;
    tone: AppToastTone;
    body?: string;
    action?: AppToastInput['action'];
    ttl: number | null;
}

const ICON: Record<AppToastTone, { icon: LucideIcon; className: string }> = {
    info: { icon: Info, className: 'text-muted-foreground' },
    success: { icon: CheckCircle2, className: 'text-brand' },
    warning: { icon: AlertTriangle, className: 'text-secondary' },
    danger: { icon: AlertTriangle, className: 'text-destructive' },
    live: { icon: Radio, className: 'text-brand' },
};

const MAX_VISIBLE = 3;
let seq = 0;

/**
 * 공통 틀의 알림 자리. 모바일은 위 헤더 바로 아래, 데스크톱은 오른쪽 위.
 * 흰 카드 하나에 아이콘 · 제목 · 한 줄 설명 · 버튼 하나 — 예배 중 화면의 앱 알림 카드와 같은 모양입니다.
 */
export default function AppToaster() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        const all = timers.current;
        const dismiss = (id: string) => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
            const timer = all.get(id);
            if (timer) clearTimeout(timer);
            all.delete(id);
        };
        const onToast = (event: Event) => {
            const input = (event as CustomEvent<AppToastInput>).detail;
            if (!input?.title) return;
            seq += 1;
            const toast: Toast = {
                id: input.id ?? `toast-${seq}`,
                group: input.group,
                tone: input.tone ?? 'info',
                title: input.title,
                body: input.body,
                action: input.action,
                ttl: input.ttl === undefined ? 4500 : input.ttl,
            };
            setToasts((current) => [toast, ...current.filter((item) => item.id !== toast.id && (!toast.group || item.group !== toast.group))].slice(0, MAX_VISIBLE));
            const old = all.get(toast.id);
            if (old) clearTimeout(old);
            if (toast.ttl !== null) all.set(toast.id, setTimeout(() => dismiss(toast.id), toast.ttl));
        };
        const onDismiss = (event: Event) => dismiss((event as CustomEvent<string>).detail);
        window.addEventListener(APP_TOAST_EVENT, onToast);
        window.addEventListener(`${APP_TOAST_EVENT}:dismiss`, onDismiss);
        return () => {
            window.removeEventListener(APP_TOAST_EVENT, onToast);
            window.removeEventListener(`${APP_TOAST_EVENT}:dismiss`, onDismiss);
            all.forEach((timer) => clearTimeout(timer));
            all.clear();
        };
    }, []);

    const close = (id: string) => window.dispatchEvent(new CustomEvent(`${APP_TOAST_EVENT}:dismiss`, { detail: id }));

    return (
        <section
            aria-label="알림"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-3 top-[calc(var(--app-header-h)+0.5rem)] z-50 flex flex-col items-center gap-2 sm:inset-x-6 lg:inset-x-auto lg:right-6 lg:top-6 lg:w-[24rem] lg:items-stretch"
        >
            {toasts.map((toast) => {
                const { icon: Icon, className } = ICON[toast.tone];
                return (
                    <div
                        key={toast.id}
                        role={toast.tone === 'danger' ? 'alert' : 'status'}
                        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-card py-3 pl-4 pr-2 text-card-foreground shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)] ring-1 ring-border animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none dark:shadow-none"
                    >
                        <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', className)} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold leading-snug tracking-tight">{toast.title}</p>
                            {toast.body ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{toast.body}</p> : null}
                        </div>
                        {toast.action ? (
                            <Link
                                href={toast.action.href}
                                onClick={() => close(toast.id)}
                                className={cn(buttonVariants({ size: 'sm', variant: toast.tone === 'live' ? 'brand' : 'secondary' }), 'shrink-0 self-center')}
                            >
                                {toast.action.label}
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => close(toast.id)}
                            aria-label="알림 닫기"
                            className="-my-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </section>
    );
}
