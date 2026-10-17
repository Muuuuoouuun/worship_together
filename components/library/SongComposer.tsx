'use client';
import { ChevronDown } from 'lucide-react';
import { createSong } from '@/actions/libraryActions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';

interface SongComposerProps {
    disabled?: boolean;
    saveAction?: (formData: FormData) => void | Promise<void>;
}

const label = 'block space-y-1.5';
const labelText = 'block text-sm font-semibold text-foreground';

export default function SongComposer({ disabled = false, saveAction = createSong }: SongComposerProps) {
    return (
        <div>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">예배곡의 키, BPM, 선택적 MusicXML 악보 소스를 등록합니다.</p>

            <form action={saveAction} onSubmit={saveAction === createSong ? undefined : event => { event.preventDefault(); void saveAction(new FormData(event.currentTarget)); }} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className={label}>
                            <span className={labelText}>곡명</span>
                            <Input name="title" placeholder="믿음으로 서리라" required />
                        </label>
                        <label className={label}>
                            <span className={labelText}>팀/아티스트</span>
                            <Input name="artist" placeholder="주일 2부팀" />
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <label className={label}>
                            <span className={labelText}>원키</span>
                            <Input name="originalKey" placeholder="G" />
                        </label>
                        <label className={label}>
                            <span className={labelText}>BPM</span>
                            <Input name="bpm" type="number" min={20} max={300} step={1} placeholder="72" />
                        </label>
                    </div>

                    <details className="group/xml border-t border-border/70">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                            고급 · MusicXML 악보 소스
                            <ChevronDown size={16} className="transition group-open/xml:rotate-180" aria-hidden="true" />
                        </summary>
                        <div className="space-y-4 pb-2 pt-2">
                            <label className={label}>
                                <span className={labelText}>MusicXML URL</span>
                                <Input name="musicXmlUrl" type="url" placeholder="https://..." />
                            </label>

                            <label className={label}>
                                <span className={labelText}>MusicXML 원문</span>
                                <Textarea name="dataXml" rows={6} placeholder="<score-partwise>...</score-partwise>" />
                            </label>
                        </div>
                    </details>

                    <Button type="submit" className="w-full px-6 sm:w-auto">
                        곡 저장
                    </Button>
                </fieldset>
            </form>
        </div>
    );
}
