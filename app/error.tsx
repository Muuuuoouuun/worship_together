'use client';

import { useEffect } from 'react';
import { ErrorScreen } from './StatusScreen';

/**
 * 앱 틀 바깥 화면(/login, /invite, /session)의 오류 경계.
 * 틀 안 화면의 오류는 app/(app)/error.tsx 가 받아 사이드바·하단 내비를 남겨 둡니다.
 */
export default function RootError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled app runtime error:', error);
    }, [error]);

    return <ErrorScreen error={error} onRetry={retry} />;
}
