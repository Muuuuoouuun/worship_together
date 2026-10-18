'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * '예배 중' 화면 디자인 시안이 함께 쓰는 목업 데이터와 진행 상태.
 * 실제 세션(components/session/*)과 같은 정보 — 곡·키·BPM·송폼·악보 쪽·큐·팀 접속 — 를 담되,
 * 저장이나 실시간 연결 없이 화면 안에서만 움직입니다.
 */

export type DraftRole = 'leader' | 'instrument' | 'sound' | 'media';

export const ROLE_LABEL: Record<DraftRole, string> = {
    leader: '인도자',
    instrument: '악기',
    sound: '음향',
    media: '미디어',
};

export interface DraftSong {
    id: string;
    title: string;
    key: string;
    bpm: number;
    meter: string;
    /** 송폼 (섹션 이름 순서) */
    form: string[];
    /** 악보 쪽 수 */
    pages: number;
    /** 섹션마다 보여 줄 첫 가사 한 줄 */
    lyrics: Record<string, string>;
    /** 섹션별 코드 진행 (악보 대신 보여 주는 코드 차트) */
    chords: Record<string, string[]>;
    note?: string;
}

export const DRAFT_SERVICE = {
    title: '주일 2부 예배',
    team: '주일 2부 예배팀',
    dateLabel: '10월 18일 (일) 오전 11:00',
    theme: '신실하신 하나님',
};

export const DRAFT_SONGS: DraftSong[] = [
    {
        id: 'song-1',
        title: '믿음으로 서리라',
        key: 'D',
        bpm: 72,
        meter: '4/4',
        form: ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
        pages: 3,
        lyrics: {
            Intro: '(전주 4마디)',
            'Verse 1': '흔들리는 세상 가운데 주 나를 붙드시네',
            Chorus: '믿음으로 서리라 주님만 의지하리',
            'Verse 2': '어두운 밤 지날 때에도 주 나와 함께하네',
            Bridge: '나의 반석 나의 구원 영원히 찬양해',
            Outro: '(후주 — 인도자 신호로 끝)',
        },
        chords: {
            Intro: ['D', 'A/C#', 'Bm7', 'G'],
            'Verse 1': ['D', 'A/C#', 'Bm7', 'G', 'D', 'A', 'G', 'A'],
            Chorus: ['G', 'A', 'F#m7', 'Bm7', 'G', 'A', 'D', 'D'],
            'Verse 2': ['D', 'A/C#', 'Bm7', 'G', 'D', 'A', 'G', 'A'],
            Bridge: ['Em7', 'F#m7', 'G', 'A', 'Em7', 'F#m7', 'G', 'Asus4 A'],
            Outro: ['G', 'A', 'D', 'D'],
        },
        note: '브릿지 2번 반복 후 후렴',
    },
    {
        id: 'song-2',
        title: '주님의 은혜',
        key: 'G',
        bpm: 68,
        meter: '6/8',
        form: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Outro'],
        pages: 2,
        lyrics: {
            Intro: '(피아노 단독)',
            Verse: '주님의 은혜 넘치네 내 삶에 가득하네',
            'Pre-Chorus': '그 사랑 다 헤아릴 수 없네',
            Chorus: '은혜 아니면 설 수 없네 주님의 은혜라',
            Outro: '(피아노로 마무리)',
        },
        chords: {
            Intro: ['G', 'C/G', 'G', 'D/F#'],
            Verse: ['G', 'D/F#', 'Em7', 'C', 'G', 'D', 'C', 'D'],
            'Pre-Chorus': ['Am7', 'Bm7', 'C', 'Dsus4 D'],
            Chorus: ['C', 'D', 'Bm7', 'Em7', 'C', 'D', 'G', 'G'],
            Outro: ['C', 'D', 'G', 'G'],
        },
    },
    {
        id: 'song-3',
        title: '보내소서',
        key: 'A',
        bpm: 76,
        meter: '4/4',
        form: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Tag'],
        pages: 2,
        lyrics: {
            Intro: '(드럼 인 — 4카운트)',
            Verse: '주께서 부르시면 내가 가리이다',
            Chorus: '나를 보내소서 주의 나라 위해',
            Tag: '나를 보내소서 (3번)',
        },
        chords: {
            Intro: ['A', 'E/G#', 'F#m7', 'D'],
            Verse: ['A', 'E/G#', 'F#m7', 'D', 'A', 'E', 'D', 'E'],
            Chorus: ['D', 'E', 'C#m7', 'F#m7', 'D', 'E', 'A', 'A'],
            Tag: ['D', 'E', 'A', 'A'],
        },
        note: '마지막 곡 — 축도 전 반주 유지',
    },
];

export type CueGroup = 'flow' | 'tempo' | 'sound' | 'band' | 'media';

export interface DraftCue {
    id: string;
    label: string;
    group: CueGroup;
    /** 받는 사람 */
    target: DraftRole | 'all';
}

export const CUE_GROUP_LABEL: Record<CueGroup, string> = {
    flow: '흐름',
    tempo: '템포·박자',
    sound: '음향·볼륨',
    band: '반주',
    media: '미디어',
};

export const DRAFT_CUES: DraftCue[] = [
    { id: 'next-section', label: '다음 섹션', group: 'flow', target: 'all' },
    { id: 'again', label: '한 번 더', group: 'flow', target: 'all' },
    { id: 'prayer', label: '기도 BGM', group: 'flow', target: 'all' },
    { id: 'ending', label: '엔딩 컷', group: 'flow', target: 'all' },
    { id: 'slower', label: '느려요', group: 'tempo', target: 'instrument' },
    { id: 'faster', label: '빨라요', group: 'tempo', target: 'instrument' },
    { id: 'drum-beat', label: '드럼 박자', group: 'tempo', target: 'instrument' },
    { id: 'vol-up', label: '볼륨 업', group: 'sound', target: 'sound' },
    { id: 'vol-down', label: '볼륨 다운', group: 'sound', target: 'sound' },
    { id: 'vocal-up', label: '보컬 UP', group: 'sound', target: 'sound' },
    { id: 'monitor', label: '모니터 체크', group: 'sound', target: 'sound' },
    { id: 'build-up', label: '반주 빌드업', group: 'band', target: 'instrument' },
    { id: 'hold', label: '반주 유지', group: 'band', target: 'instrument' },
    { id: 'next-lyric', label: '다음 가사', group: 'media', target: 'media' },
];

export interface DraftMember {
    name: string;
    role: DraftRole;
    part: string;
    online: boolean;
    /** 마지막으로 확인한 큐 (없으면 대기) */
    ack?: string;
}

export const DRAFT_TEAM: DraftMember[] = [
    { name: '김하늘', role: 'leader', part: '인도 · 어쿠스틱', online: true },
    { name: '이은혜', role: 'instrument', part: '건반', online: true, ack: '확인' },
    { name: '박소망', role: 'instrument', part: '드럼', online: true, ack: '확인' },
    { name: '최믿음', role: 'instrument', part: '베이스', online: true },
    { name: '정사랑', role: 'instrument', part: '일렉 기타', online: false },
    { name: '한기쁨', role: 'sound', part: '음향', online: true, ack: '확인' },
    { name: '오평안', role: 'media', part: '자막', online: true },
];

export interface CueLogEntry {
    id: string;
    label: string;
    from: string;
    target: DraftRole | 'all';
    /** 화면에 보이는 상대 시각 */
    at: string;
}

export const DRAFT_CUE_LOG: CueLogEntry[] = [
    { id: 'log-3', label: '보컬 UP', from: '김하늘', target: 'sound', at: '방금' },
    { id: 'log-2', label: '드럼 박자', from: '김하늘', target: 'instrument', at: '1분 전' },
    { id: 'log-1', label: '브릿지 2번 반복 후 후렴으로 갑니다', from: '김하늘', target: 'all', at: '3분 전' },
];

/** 예배 경과 시간 (목업 시작 기준) */
export const DRAFT_ELAPSED = '12:48';

export interface MockLive {
    songs: DraftSong[];
    songIndex: number;
    song: DraftSong;
    nextSong: DraftSong | null;
    sectionIndex: number;
    section: string;
    nextSection: string | null;
    page: number;
    bpm: number;
    log: CueLogEntry[];
    /** 방금 보낸 큐 — 잠깐 보여 주는 확인 표시용 (약 2초 뒤 null) */
    flash: CueLogEntry | null;
    goSection: (index: number) => void;
    nextSectionStep: () => void;
    prevSectionStep: () => void;
    goSong: (index: number) => void;
    setPage: (page: number) => void;
    nudgeBpm: (delta: number) => void;
    sendCue: (cue: Pick<DraftCue, 'label' | 'target'>) => void;
}

/**
 * 시안 화면 안에서 곡·섹션·악보 쪽·BPM·큐를 움직이는 상태.
 * 섹션을 넘기면 악보 쪽도 대략 맞춰 따라갑니다.
 */
export function useMockLive({ songIndex: initialSong = 0, sectionIndex: initialSection = 2 }: { songIndex?: number; sectionIndex?: number } = {}): MockLive {
    const [songIndex, setSongIndex] = useState(initialSong);
    const [sectionIndex, setSectionIndex] = useState(initialSection);
    const [pageOverride, setPageOverride] = useState<number | null>(null);
    const [bpmDelta, setBpmDelta] = useState(0);
    const [log, setLog] = useState<CueLogEntry[]>(DRAFT_CUE_LOG);
    const [flash, setFlash] = useState<CueLogEntry | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seq = useRef(0);

    useEffect(() => () => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
    }, []);

    const song = DRAFT_SONGS[songIndex];
    const safeSection = Math.min(sectionIndex, song.form.length - 1);
    const autoPage = Math.min(song.pages, Math.floor((safeSection / song.form.length) * song.pages) + 1);

    const goSection = useCallback((index: number) => {
        setSectionIndex(Math.max(0, Math.min(index, DRAFT_SONGS[songIndex].form.length - 1)));
        setPageOverride(null);
    }, [songIndex]);

    const goSong = useCallback((index: number) => {
        setSongIndex(Math.max(0, Math.min(index, DRAFT_SONGS.length - 1)));
        setSectionIndex(0);
        setPageOverride(null);
        setBpmDelta(0);
    }, []);

    const nextSectionStep = useCallback(() => {
        const form = DRAFT_SONGS[songIndex].form;
        if (sectionIndex < form.length - 1) goSection(sectionIndex + 1);
        else if (songIndex < DRAFT_SONGS.length - 1) goSong(songIndex + 1);
    }, [goSection, goSong, sectionIndex, songIndex]);

    const prevSectionStep = useCallback(() => {
        if (sectionIndex > 0) goSection(sectionIndex - 1);
        else if (songIndex > 0) {
            const prev = songIndex - 1;
            setSongIndex(prev);
            setSectionIndex(DRAFT_SONGS[prev].form.length - 1);
            setPageOverride(null);
            setBpmDelta(0);
        }
    }, [goSection, sectionIndex, songIndex]);

    const sendCue = useCallback((cue: Pick<DraftCue, 'label' | 'target'>) => {
        seq.current += 1;
        const entry: CueLogEntry = { id: `sent-${seq.current}`, label: cue.label, from: '나', target: cue.target, at: '방금' };
        setLog((current) => [entry, ...current.map((item) => (item.at === '방금' ? { ...item, at: '1분 전' } : item))].slice(0, 6));
        setFlash(entry);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 2000);
    }, []);

    return {
        songs: DRAFT_SONGS,
        songIndex,
        song,
        nextSong: DRAFT_SONGS[songIndex + 1] ?? null,
        sectionIndex: safeSection,
        section: song.form[safeSection],
        nextSection: song.form[safeSection + 1] ?? null,
        page: pageOverride ?? autoPage,
        bpm: song.bpm + bpmDelta,
        log,
        flash,
        goSection,
        nextSectionStep,
        prevSectionStep,
        goSong,
        setPage: (page: number) => setPageOverride(Math.max(1, Math.min(page, song.pages))),
        nudgeBpm: (delta: number) => setBpmDelta((current) => current + delta),
        sendCue,
    };
}
