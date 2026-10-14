'use client';

import Script from 'next/script';
import { useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

declare global {
    interface Window {
        Kakao?: { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(options: { objectType: 'text'; text: string; link: { webUrl: string; mobileWebUrl: string }; buttonTitle: string }): void } };
    }
}
/** 카카오톡 공유 버튼만 카카오 노란색을 씁니다 (외부 서비스 고유 색). */
const kakaoButton = cn(buttonVariants(), 'bg-[#FEE500] text-[#191919] hover:bg-[#F4DC00]');

export default function InviteShareButtons({ url, teamName }: { url: string; teamName: string }) {
    const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    const [ready, setReady] = useState(false);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState('');
    const [fallback, setFallback] = useState(false);
    const text = `${teamName}에서 함께 예배를 준비해요. 링크를 열고 로그인한 뒤 팀에 참여해주세요.`;
    const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(url);
    function initKakao() {
        try {
            if (!key || !window.Kakao) return;
            if (!window.Kakao.isInitialized()) window.Kakao.init(key);
            setReady(true);
        } catch { setStatus('카카오 공유를 열지 못했습니다. 링크 복사를 이용해주세요.'); }
    }
    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setStatus('초대 링크를 복사했습니다. 원하는 대화방에 붙여넣으세요.');
            setFallback(false);
            setTimeout(() => setCopied(false), 2200);
        }
        catch { setFallback(true); setStatus('아래 링크를 길게 눌러 복사해주세요.'); }
    }
    function kakao() {
        try {
            if (!window.Kakao || !ready) throw new Error('not ready');
            window.Kakao.Share.sendDefault({ objectType: 'text', text, link: { webUrl: url, mobileWebUrl: url }, buttonTitle: '예배팀 참여하기' });
            setStatus('카카오톡 공유창에서 받는 사람을 선택해주세요.');
        } catch { setStatus('카카오톡 공유창을 열지 못했습니다. 링크 복사를 이용해주세요.'); }
    }
    async function share() {
        if (!navigator.share) { await copy(); return; }
        try { await navigator.share({ title: `${teamName} 초대`, text, url }); setStatus('공유창을 닫았습니다. 참여한 팀원은 명단에서 확인할 수 있습니다.'); }
        catch (error) { if (error instanceof Error && error.name === 'AbortError') setStatus('공유를 취소했습니다.'); else { setStatus('공유창을 열지 못했습니다. 링크 복사를 이용해주세요.'); setFallback(true); } }
    }
    return <div className="@container space-y-3">
        {key && <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js" strategy="afterInteractive" onReady={initKakao} onError={() => setStatus('카카오 공유를 불러오지 못했습니다. 링크 복사를 이용해주세요.')} />}
        <div className="grid gap-2 @lg:grid-cols-3">
            <button className={kakaoButton} disabled={!ready || local} onClick={kakao}><MessageCircle aria-hidden="true" /> 카카오톡 초대</button>
            <button className={cn(buttonVariants({ variant: 'outline' }), copied && 'border-success/40 text-success hover:bg-success/10')} onClick={() => void copy()}>
                {copied ? <Check className="animate-check-pop" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? '복사 완료!' : '링크 복사'}
            </button>
            <button className={buttonVariants({ variant: 'outline' })} onClick={() => void share()}><Share2 aria-hidden="true" /> 다른 앱으로 공유</button>
        </div>
        {!key && <p className="text-xs leading-relaxed text-muted-foreground">카카오 공유를 준비 중입니다. 복사한 링크를 카카오톡에 붙여넣어 초대할 수 있습니다.</p>}
        {local && <p className="text-xs leading-relaxed text-muted-foreground">현재 링크는 이 컴퓨터에서만 열립니다. 다른 기기로 초대하려면 공개 서비스 주소를 연결해야 합니다.</p>}
        <label className="block text-xs font-medium text-muted-foreground">초대 링크<Input aria-label="온라인 팀 초대 링크" value={url} readOnly onFocus={event => event.target.select()} className="mt-1.5" /></label>
        {fallback && <Textarea aria-label="직접 복사할 초대 내용" readOnly value={`${text}\n${url}`} rows={4} onFocus={event => event.target.select()} />}
        <p role="status" className={cn('text-sm leading-relaxed text-foreground', status && 'animate-success-bounce')}>{status}</p>
    </div>;
}
