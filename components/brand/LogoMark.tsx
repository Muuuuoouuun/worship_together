import { cn } from '@/lib/utils';

/*
 * Worship Together 로고 — 두 개의 V 가 겹쳐 W (함께). 초록 바탕 · 왼쪽 V 민트 · 오른쪽 V 흰색.
 * 앱 아이콘(public/icons · android 런처)과 같은 그림입니다. 밝은 · 어두운 화면 모두 같은 색을 씁니다.
 * bold: 32px 이하로 작게 쓸 때 선을 굵게 (파비콘과 같은 비율)
 */
export default function LogoMark({ className, bold = false, title }: { className?: string; bold?: boolean; title?: string }) {
    const scale = bold ? 0.72 : 0.64;
    return (
        <svg viewBox="0 0 64 64" className={cn('shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
            <rect width="64" height="64" rx="14.5" fill="#153E3B" />
            <g transform={`translate(32 32) scale(${scale}) translate(-32 -32)`} fill="none" strokeWidth={bold ? 9 : 7.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 17 L21 46 L32 17" stroke="#9EC7B5" />
                <path d="M32 17 L43 46 L54 17" stroke="#FFFFFF" />
            </g>
        </svg>
    );
}
