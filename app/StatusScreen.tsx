import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw, type LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatusScreenProps {
    icon: LucideIcon;
    eyebrow?: string;
    title: string;
    description: string;
    /** 오류 내용 같은 보조 정보 */
    detail?: ReactNode;
    actions: ReactNode;
    /** 앱 틀(사이드바·하단 내비) 안에서 보일 때: 화면 높이를 채우지 않고 위아래 여백만 둡니다. */
    inShell?: boolean;
}

/**
 * 404·오류 화면이 함께 쓰는 가운데 정렬 안내.
 * 페이지 머리말과 같은 글자 크기(작은 회색 머리글 + text-2xl semibold 제목)와 알약 버튼을 씁니다.
 */
export default function StatusScreen({ icon: Icon, eyebrow, title, description, detail, actions, inShell = false }: StatusScreenProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-4 text-center', inShell ? 'py-16' : 'min-h-[70dvh] py-10')}>
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Icon size={22} aria-hidden="true" />
            </span>
            {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
            <h1 className={cn('text-balance text-2xl font-semibold tracking-tight text-foreground', eyebrow && 'mt-0.5')}>{title}</h1>
            <p className="mt-1.5 max-w-md text-balance text-sm leading-relaxed text-muted-foreground">{description}</p>
            {detail}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
        </div>
    );
}

/** 오류 경계(app/error.tsx, app/(app)/error.tsx)가 함께 쓰는 본문 */
export function ErrorScreen({ error, onRetry, inShell = false }: { error: Error & { digest?: string }; onRetry: () => void; inShell?: boolean }) {
    return (
        <StatusScreen
            icon={AlertTriangle}
            title="일시적인 오류가 발생했습니다"
            description="화면을 불러오는 중 문제가 생겼습니다. 다시 시도하시거나 오늘 화면으로 돌아가실 수 있습니다."
            inShell={inShell}
            detail={
                error.message ? (
                    <p className="mt-4 max-w-lg break-all rounded-2xl bg-destructive/10 px-4 py-3 text-left text-xs text-destructive">{error.message}</p>
                ) : null
            }
            actions={
                <>
                    <button type="button" onClick={() => onRetry()} className={buttonVariants()}>
                        <RefreshCw aria-hidden="true" />
                        다시 시도하기
                    </button>
                    <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
                        <Home aria-hidden="true" />
                        오늘로 가기
                    </Link>
                </>
            }
        />
    );
}
