'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '../StatusScreen';

/**
 * 틀 안 화면(/dashboard/**, /community 등)의 오류 경계.
 * app/(app)/layout.tsx 아래에 있으므로 오류가 나도 사이드바·하단 내비는 그대로 남습니다.
 * retry() 는 서버 데이터를 다시 받아 화면을 다시 그립니다.
 */
export default function AppError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled app runtime error:', error);
    }, [error]);

    return <ErrorScreen error={error} onRetry={retry} inShell />;
}
