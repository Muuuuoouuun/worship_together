import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/server/viewer';
import LiveSessionScreen from '@/components/live/LiveSessionScreen';

export const metadata: Metadata = { title: '예배 중', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LiveSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    const viewer = await getViewer();
    if (!viewer) redirect(`/login?callbackUrl=${encodeURIComponent(`/live/${sessionId}`)}`);
    return <LiveSessionScreen sessionId={sessionId} />;
}
