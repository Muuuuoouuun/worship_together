'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { isIOS, isNativeApp, isStandalonePWA } from '@/lib/platform';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const emptySubscribe = () => () => {};

// 모바일: 하단 내비(4rem) 위로 띄우고, 라이브 미니바(4.25rem 위, 약 3.75rem 높이)가 떠 있으면 그 위로 올립니다.
// 데스크톱: 사이드바(16rem) 옆 본문 왼쪽 아래. 모달(z-50)보다 낮은 z-30.
const BANNER_POSITION =
    "fixed z-30 inset-x-4 mx-auto max-w-md bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] " +
    "max-lg:[body:has(aside[aria-label='라이브_예배_빠른_실행_바'])_&]:bottom-[calc(env(safe-area-inset-bottom)+8.75rem)] " +
    "lg:bottom-6 lg:left-[calc(16rem+1.5rem)] lg:right-auto lg:inset-x-auto lg:mx-0 lg:max-w-sm " +
    "animate-in slide-in-from-bottom duration-300";

function checkIosEligibility(): boolean {
    if (typeof window === 'undefined') return false;
    if (isStandalonePWA() || isNativeApp() || !isIOS()) return false;
    const dismissedAt = localStorage.getItem('worship_pwa_prompt_dismissed');
    if (dismissedAt) {
        const daysSinceDismissed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) return false;
    }
    return true;
}

export default function PwaInstallPrompt() {
    const pathname = usePathname();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [manuallyDismissed, setManuallyDismissed] = useState(false);

    const isIosEligible = useSyncExternalStore(
        emptySubscribe,
        checkIosEligibility,
        () => false
    );

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            if (isStandalonePWA() || isNativeApp()) return;
            const dismissedAt = localStorage.getItem('worship_pwa_prompt_dismissed');
            if (dismissedAt) {
                const daysSinceDismissed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
                if (daysSinceDismissed < 7) return;
            }
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            setDeferredPrompt(null);
            setManuallyDismissed(true);
        }
    };

    const handleDismiss = () => {
        setManuallyDismissed(true);
        setDeferredPrompt(null);
        localStorage.setItem('worship_pwa_prompt_dismissed', Date.now().toString());
    };

    // 무대/세션 화면에서는 조작 버튼을 가리지 않도록 표시하지 않습니다.
    if (pathname?.startsWith('/session')) return null;
    if (manuallyDismissed) return null;

    // 1) Chrome/Android/Desktop 설치 프롬프트가 지원되는 경우
    if (deferredPrompt) {
        return (
            <div className={BANNER_POSITION}>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Smartphone size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground">Worship Together 앱 설치</p>
                            <p className="text-xs text-muted-foreground">홈 화면에 추가해 전체화면으로 편리하게 쓰세요.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => void handleInstallClick()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition"
                        >
                            <Download size={14} />
                            설치
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="-mr-1 inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition"
                            aria-label="안내 닫기"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 2) iOS Safari 사용자를 위한 홈 화면 추가 가이드 (브라우저 정책상 원클릭 설치 불가)
    if (isIosEligible) {
        return (
            <div className={BANNER_POSITION}>
                <div className="relative rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
                    <button
                        onClick={handleDismiss}
                        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition"
                        aria-label="안내 닫기"
                    >
                        <X size={16} />
                    </button>
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
                            <Share size={18} />
                        </div>
                        <div className="min-w-0 pr-8">
                            <p className="text-sm font-bold text-foreground">아이패드/아이폰 앱으로 추가하기</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                사파리 하단의 <span className="font-semibold text-foreground">[공유]</span> 버튼을 누르고 <span className="font-semibold text-foreground">[홈 화면에 추가]</span>를 선택하면 보면대용 전체화면 앱으로 사용할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
