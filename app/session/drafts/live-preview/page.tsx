import type { Metadata } from 'next';
import LivePreview from '@/components/live/preview/LivePreview';

export const metadata: Metadata = {
    title: '예배 중 화면 미리보기',
};

interface LivePreviewPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * 개발용 미리보기 — 실제 예배 중 화면(LiveScreen)을 메모리 속 가짜 모델로 띄웁니다.
 * - ?control=0 : 따라가는 사람으로 시작 (기본은 진행하는 사람)
 * - ?bar=0     : 위의 상황 흉내 막대 없이 (스크린샷용)
 * - ?scene=cue · notices · noform · ended : 알림이 떠 있거나 송폼 없는 곡 · 마친 화면으로 시작
 */
export default async function LivePreviewPage({ searchParams }: LivePreviewPageProps) {
    const params = await searchParams;
    const control = params.control !== '0';
    const bar = params.bar !== '0';
    const scene = typeof params.scene === 'string' ? params.scene : null;
    return <LivePreview key={`${control}-${scene ?? ''}`} initialControl={control} showBar={bar} scene={scene} />;
}
