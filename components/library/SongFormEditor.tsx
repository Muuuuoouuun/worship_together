'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatTimestamp, parseChapterText, parseTimestamp, validateYouTubeUrl, type SongForm, type SongFormSection } from '@/lib/songForm';
import { saveSongForm } from '@/lib/songFormStorage';
import { createClientId } from '@/lib/clientId';

export default function SongFormEditor({ songId, teamId, initialForm }: { songId: string; teamId: string; initialForm: SongForm | null }) {
    const [sections, setSections] = useState<SongFormSection[]>(initialForm?.sections ?? []);
    const [url, setUrl] = useState(initialForm?.youtubeUrl ?? '');
    const [source, setSource] = useState<SongForm['source']>(initialForm?.source ?? 'manual');
    const [chapters, setChapters] = useState('');
    const [message, setMessage] = useState('');
    const [dirty, setDirty] = useState(false);
    const [invalidTimes, setInvalidTimes] = useState<string[]>([]);
    function change(next: SongFormSection[]) { setSections(next); setDirty(true); setMessage(''); }
    function move(index: number, offset: number) {
        const next = [...sections];
        [next[index], next[index + offset]] = [next[index + offset], next[index]];
        // Timings belong to the supplied recording. A reordered arrangement no longer has verified timings.
        change(next.map(section => ({ ...section, startSeconds: null })));
        setInvalidTimes([]);
        setSource('manual');
        setMessage('순서를 바꾸어 영상 시작 시간을 초기화했습니다. 필요하면 다시 입력해주세요.');
    }
    function parse() {
        if (!validateYouTubeUrl(url)) { setMessage('올바른 HTTPS 유튜브 영상 링크를 입력해주세요.'); return; }
        const result = parseChapterText(chapters);
        if (result.errors.length) { setMessage(result.errors.join(' ')); return; }
        change(result.sections); setSource('chapters'); setInvalidTimes([]);
        setMessage(`${result.sections.length}개 섹션을 텍스트에서 읽었습니다. 순서를 확인한 뒤 저장해주세요.`);
    }
    function save() {
        const youtubeUrl = url.trim() ? validateYouTubeUrl(url) : null;
        if (url.trim() && !youtubeUrl) { setMessage('올바른 HTTPS 유튜브 영상 링크를 입력해주세요.'); return; }
        if (invalidTimes.length || sections.some(s => !s.label.trim())) { setMessage('섹션 이름과 시작 시간 형식을 확인해주세요.'); return; }
        const timed = sections.filter(s => s.startSeconds !== null);
        if (timed.some((s, i) => i > 0 && s.startSeconds! <= timed[i - 1].startSeconds!)) { setMessage('시작 시간은 섹션 순서대로 증가해야 합니다.'); return; }
        try {
            saveSongForm({ version: 1, songId, youtubeUrl, sections: sections.map(s => ({ ...s, label: s.label.trim() })), source, updatedAt: new Date().toISOString() }, teamId);
            setDirty(false); setMessage('송폼을 이 브라우저에 저장했습니다.');
        } catch (error) { setMessage(error instanceof Error ? error.message : '송폼 저장에 실패했습니다.'); }
    }
    return <div className="mt-4 space-y-4 border-t border-primary/10 pt-4">
        <p className="text-sm text-muted-foreground">섹션 버튼으로 연주 순서를 만들고 반복 구간을 추가하세요. 송폼은 이 브라우저에 저장되며 다른 기기와 자동 공유되지 않습니다.</p>
        <div className="flex flex-wrap gap-2">
            {['Intro', 'Verse 1', 'Verse 2', 'Pre-Chorus', 'Chorus', 'Bridge', 'Interlude', 'Outro'].map(label =>
                <Button key={label} type="button" variant="outline" className="min-h-11" disabled={sections.length >= 100} onClick={() => { change([...sections, { id: createClientId(), label, startSeconds: null }]); setSource('manual'); }}>+ {label}</Button>)}
        </div>
        {sections.length === 0 && <p className="text-sm text-muted-foreground">아직 저장된 송폼이 없습니다.</p>}
        <ol className="space-y-3">
            {sections.map((section, index) => <li key={section.id} className="rounded-xl border border-primary/10 p-3">
                <div className="grid grid-cols-[1fr_6.5rem] gap-2">
                    <label className="min-w-0 text-xs">{index + 1}. 섹션 이름<Input aria-label={`${index + 1}번 섹션 이름`} value={section.label} maxLength={80} className="mt-1 min-h-11" onChange={e => change(sections.map(s => s.id === section.id ? { ...s, label: e.target.value } : s))} /></label>
                    <label className="text-xs">시작 시간 (선택)<Input key={`${section.id}-${section.startSeconds}`} aria-label={`${index + 1}번 시작 시간`} defaultValue={section.startSeconds === null ? '' : formatTimestamp(section.startSeconds)} placeholder="0:00" className="mt-1 min-h-11" onBlur={e => {
                        const value = e.target.value.trim(); const seconds = value ? parseTimestamp(value) : null;
                        if (value && seconds === null) { setInvalidTimes(ids => [...new Set([...ids, section.id])]); setMessage('시간은 0:00 또는 1:02:03 형식으로 입력해주세요.'); return; }
                        setInvalidTimes(ids => ids.filter(id => id !== section.id)); change(sections.map(s => s.id === section.id ? { ...s, startSeconds: seconds } : s));
                    }} /></label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11" disabled={index === 0} aria-label={`${index + 1}번 섹션 위로`} onClick={() => move(index, -1)}>위로</Button>
                    <Button type="button" variant="outline" className="min-h-11" disabled={index === sections.length - 1} aria-label={`${index + 1}번 섹션 아래로`} onClick={() => move(index, 1)}>아래로</Button>
                    <Button type="button" variant="ghost" className="min-h-11" aria-label={`${index + 1}번 섹션 삭제`} onClick={() => { change(sections.filter(s => s.id !== section.id)); setInvalidTimes(ids => ids.filter(id => id !== section.id)); }}>삭제</Button>
                    {section.startSeconds !== null && validateYouTubeUrl(url) && <a className="flex min-h-11 items-center px-2 text-sm underline" href={`${validateYouTubeUrl(url)}&t=${section.startSeconds}s`} target="_blank" rel="noreferrer">영상 확인 ↗</a>}
                </div>
            </li>)}
        </ol>
        <details className="rounded-xl bg-primary/5 p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">고급 · 유튜브 챕터로 송폼 만들기</summary>
            <p className="my-3 text-sm leading-relaxed text-muted-foreground">영상 설명의 타임스탬프·챕터 텍스트를 직접 붙여넣으면 섹션으로 변환합니다. URL만으로 오디오를 분석하는 기능은 아직 연결되지 않았습니다. 입력한 챕터가 곡의 섹션인지 직접 확인해주세요.</p>
            <label className="block text-sm">유튜브 영상 링크<Input type="url" value={url} placeholder="https://www.youtube.com/watch?v=..." className="mt-1 min-h-11" onChange={e => { setUrl(e.target.value); setDirty(true); }} /></label>
            <label className="mt-3 block text-sm">챕터 텍스트<textarea value={chapters} onChange={e => setChapters(e.target.value)} rows={5} maxLength={20000} placeholder={'0:00 Intro\n0:24 Verse 1\n1:02 Chorus'} className="mt-1 w-full rounded-lg border border-primary/20 bg-background p-3" /></label>
            <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={parse}>텍스트에서 섹션 가져오기{sections.length > 0 ? ' (현재 순서 대체)' : ''}</Button>
        </details>
        <div className="flex flex-wrap items-center gap-3"><Button type="button" className="min-h-11" onClick={save}>송폼 저장</Button><span className="text-xs text-muted-foreground">{dirty ? '저장하지 않은 변경 사항' : initialForm ? '저장된 송폼' : ''}</span></div>
        <p role="status" aria-live="polite" className="text-sm text-primary">{message}</p>
    </div>;
}
