'use client';
import { useState } from 'react';
import { createSetlist } from '@/actions/libraryActions';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LibrarySong } from '@/lib/libraryPrototypeStorage';

export default function SetlistComposer({ songs, disabled = false, saveAction = createSetlist }: {
    songs: LibrarySong[]; disabled?: boolean; saveAction?: (data: FormData) => void | Promise<void>;
}) {
    const [order, setOrder] = useState<string[]>([]);
    function move(index: number, offset: number) {
        setOrder(ids => { const next = [...ids]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
    }
    return <GlassCard>
        <h2 className="text-xl font-bold">콘티 만들기</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">곡을 추가한 순서로 저장합니다. 각 곡은 한 번만 추가할 수 있으며, 후렴 반복은 곡의 송폼에서 설정하세요.</p>
        <form action={saveAction} onSubmit={saveAction === createSetlist ? undefined : event => { event.preventDefault(); void saveAction(new FormData(event.currentTarget)); }}>
            <fieldset disabled={disabled} className="space-y-4">
                <label className="block text-sm">예배 제목<Input name="title" required maxLength={120} className="mt-1 min-h-11" placeholder="주일 2부 예배" /></label>
                <label className="block text-sm">예배 일시<Input name="worshipDate" type="datetime-local" required className="mt-1 min-h-11" /></label>
                <label className="block text-sm">주제 (선택)<Input name="theme" className="mt-1 min-h-11" /></label>
                <div className="flex max-h-64 flex-wrap gap-2 overflow-auto">
                    {songs.map(song => <Button type="button" key={song.id} variant="outline" disabled={order.includes(song.id)} className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => setOrder(ids => ids.includes(song.id) ? ids : [...ids, song.id])}>{order.includes(song.id) ? '추가됨 ·' : '+'} {song.title}</Button>)}
                    {!songs.length && <p className="text-sm">먼저 곡을 추가해주세요.</p>}
                </div>
                <ol className="space-y-2">
                    {order.map((id, index) => <li key={id} className="rounded-lg border border-primary/15 p-3">
                        <input type="hidden" name="songIds" value={id} />
                        <p className="mb-2 text-sm font-semibold">{index + 1}. {songs.find(song => song.id === id)?.title}</p>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="min-h-11" disabled={index === 0} aria-label={`${index + 1}번 곡 위로`} onClick={() => move(index, -1)}>위로</Button>
                            <Button type="button" variant="outline" className="min-h-11" disabled={index === order.length - 1} aria-label={`${index + 1}번 곡 아래로`} onClick={() => move(index, 1)}>아래로</Button>
                            <Button type="button" variant="ghost" className="min-h-11" aria-label={`${index + 1}번 곡 삭제`} onClick={() => setOrder(ids => ids.filter((_, i) => i !== index))}>삭제</Button>
                        </div>
                    </li>)}
                </ol>
                <Button className="min-h-11 w-full" type="submit" disabled={!order.length}>콘티 저장</Button>
            </fieldset>
        </form>
    </GlassCard>;
}
