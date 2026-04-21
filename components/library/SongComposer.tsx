import { createSong } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilePlus2 } from 'lucide-react';

interface SongComposerProps {
    disabled?: boolean;
}

export default function SongComposer({ disabled = false }: SongComposerProps) {
    return (
        <GlassCard className="border-primary/10">
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <FilePlus2 size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-serif font-bold text-primary">Add Song</h2>
                    <p className="mt-1 text-sm leading-relaxed text-primary/50">
                        Register a worship song with its key, tempo, and optional MusicXML source.
                    </p>
                </div>
            </div>

            <form action={createSong} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">Title</span>
                            <Input name="title" placeholder="How Great Is Our God" required />
                        </label>
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">Artist</span>
                            <Input name="artist" placeholder="Chris Tomlin" />
                        </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">Original Key</span>
                            <Input name="originalKey" placeholder="G" />
                        </label>
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">BPM</span>
                            <Input name="bpm" type="number" min={1} placeholder="72" />
                        </label>
                    </div>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-primary">MusicXML URL</span>
                        <Input name="musicXmlUrl" type="url" placeholder="https://..." />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-semibold text-primary">Raw MusicXML</span>
                        <textarea
                            name="dataXml"
                            rows={6}
                            placeholder="<score-partwise>...</score-partwise>"
                            className="w-full rounded-xl border border-primary/10 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                        />
                    </label>

                    <Button type="submit" className="h-11 w-full rounded-full px-6 sm:w-auto">
                        Save Song
                    </Button>
                </fieldset>
            </form>
        </GlassCard>
    );
}
