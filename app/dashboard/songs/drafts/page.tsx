import type { Metadata } from 'next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import MeshBackground from '@/components/ui/MeshBackground';
import SetlistDraftGallery from '@/components/library/drafts/SetlistDraftGallery';
import type { DraftTab, DraftVariant } from '@/components/library/drafts/draftData';

export const metadata: Metadata = {
    title: '콘티·순서 디자인 시안',
};

interface SetlistDraftsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VARIANTS: Record<string, DraftVariant> = {
    a: 'stack',
    b: 'cuesheet',
    c: 'stage',
    stack: 'stack',
    cuesheet: 'cuesheet',
    stage: 'stage',
};

export default async function SetlistDraftsPage({ searchParams }: SetlistDraftsPageProps) {
    const params = await searchParams;
    const variant = VARIANTS[getParam(params.v)?.toLowerCase() ?? ''] ?? 'stack';
    const tab: DraftTab = getParam(params.tab) === 'order' ? 'order' : 'setlists';

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <MeshBackground />
            <SetlistDraftGallery initialVariant={variant} initialTab={tab} />
        </DashboardLayout>
    );
}

function getParam(value: string | string[] | undefined): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
