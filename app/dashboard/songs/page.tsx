import type { ComponentType } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SongBpmPresetManager from '@/components/library/SongBpmPresetManager';
import SongComposer from '@/components/library/SongComposer';
import SongLibraryList from '@/components/library/SongLibraryList';
import SetlistComposer from '@/components/library/SetlistComposer';
import SetlistTimeline from '@/components/library/SetlistTimeline';
import SongUsageInsights from '@/components/library/SongUsageInsights';
import MeshBackground from '@/components/ui/MeshBackground';
import GlassCard from '@/components/ui/GlassCard';
import { DEMO_TEAM_ID } from '@/lib/constants';
import { getSetlistsByTeam, getSongsByTeam } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { CalendarRange, Music4, RadioTower } from 'lucide-react';

interface LibraryPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const successMessages: Record<string, string> = {
    bpm: 'Song BPM preset updated.',
    song: 'Song saved to the library.',
    setlist: 'Setlist scheduled successfully.',
    template: 'Setlist duplicated for next week.',
};

const errorMessages: Record<string, string> = {
    'missing-song-id': 'Song target is missing.',
    'missing-song-title': 'Song title is required.',
    'invalid-bpm': 'BPM must be a positive number.',
    'create-song': 'Song could not be saved. Check Supabase permissions and try again.',
    'update-song-bpm': 'BPM preset could not be saved. Check Supabase permissions and try again.',
    'missing-setlist-title': 'Setlist title is required.',
    'missing-setlist-id': 'Setlist target is missing.',
    'missing-worship-date': 'Worship date is required.',
    'invalid-worship-date': 'Worship date format is invalid.',
    'create-setlist': 'Setlist could not be saved. Check Supabase permissions and try again.',
    'duplicate-setlist': 'Setlist could not be duplicated. Check Supabase permissions and try again.',
};

export default async function SongLibraryPage({ searchParams }: LibraryPageProps) {
    const params = await searchParams;
    const [songs, setlists] = await Promise.all([
        getSongsByTeam(DEMO_TEAM_ID),
        getSetlistsByTeam(DEMO_TEAM_ID),
    ]);
    const hasSupabase = Boolean(supabase);
    const createdKey = getParam(params.created);
    const errorKey = getParam(params.error);

    return (
        <DashboardLayout currentPath="/dashboard/songs">
            <MeshBackground />
            <div className="mx-auto flex max-w-7xl flex-col gap-8">
                <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <span className="inline-flex rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-secondary">
                            Library Workspace
                        </span>
                        <div>
                            <h1 className="text-4xl font-serif font-black tracking-tight text-primary md:text-5xl">
                                Songs, Setlists, and Service Prep
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-primary/55 md:text-base">
                                Build the source material that powers the live worship session. This is the planning layer before conductor sync.
                            </p>
                        </div>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
                        <MetricCard icon={Music4} label="Songs" value={songs.length} />
                        <MetricCard icon={CalendarRange} label="Setlists" value={setlists.length} />
                        <MetricCard
                            icon={RadioTower}
                            label="Ready"
                            value={setlists.filter((setlist) => setlist.songs.length > 0).length}
                        />
                    </div>
                </section>

                {createdKey && successMessages[createdKey] && (
                    <GlassCard className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                        <p className="text-sm font-semibold">{successMessages[createdKey]}</p>
                    </GlassCard>
                )}

                {errorKey && errorMessages[errorKey] && (
                    <GlassCard className="border-red-500/20 bg-red-500/10 text-red-600">
                        <p className="text-sm font-semibold">{errorMessages[errorKey]}</p>
                    </GlassCard>
                )}

                {!hasSupabase && (
                    <GlassCard className="border-amber-500/20 bg-amber-500/10">
                        <p className="text-sm font-semibold text-amber-700">Supabase env vars are empty.</p>
                        <p className="mt-2 text-sm leading-relaxed text-amber-700/80">
                            The library UI is available, but create actions stay disabled until `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`.
                        </p>
                    </GlassCard>
                )}

                <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="space-y-6">
                        <SongComposer disabled={!hasSupabase} />
                        <SetlistComposer songs={songs} disabled={!hasSupabase} />
                    </div>

                    <div className="space-y-6">
                        <SongBpmPresetManager songs={songs} disabled={!hasSupabase} />
                        <SongUsageInsights songs={songs} setlists={setlists} />
                        <SongLibraryList songs={songs} />
                        <SetlistTimeline setlists={setlists} />
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ size?: number }>;
    label: string;
    value: number;
}) {
    return (
        <GlassCard className="border-primary/10 px-5 py-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/5 text-primary/60">
                    <Icon size={18} />
                </div>
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/35">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-primary">{value}</p>
                </div>
            </div>
        </GlassCard>
    );
}

function getParam(value: string | string[] | undefined): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    return null;
}
