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
                        <h2 className="text-xl font-serif font-bold text-primary">곡 추가</h2>
                        <p className="mt-1 text-sm leading-relaxed text-primary/50">
                        예배곡의 키, BPM, 선택적 MusicXML 악보 소스를 등록합니다.
                    </p>
                </div>
            </div>

            <form action={createSong} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">곡명</span>
                            <Input name="title" placeholder="믿음으로 서리라" required />
                        </label>
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">팀/아티스트</span>
                            <Input name="artist" placeholder="주일 2부팀" />
                        </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                            <span className="text-sm font-semibold text-primary">원키</span>
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
                            <span className="text-sm font-semibold text-primary">MusicXML 원문</span>
                        <textarea
                            name="dataXml"
                            rows={6}
                            placeholder="<score-partwise>...</score-partwise>"
                            className="w-full rounded-xl border border-primary/10 bg-background/80 px-4 py-3 text-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                        />
                    </label>

                    <Button type="submit" className="h-11 w-full rounded-full px-6 sm:w-auto">
                        곡 저장
                    </Button>
                </fieldset>
            </form>
        </GlassCard>
    );
}
