'use client';

import { useEffect, useState } from 'react';

/*
 * 예배 중 화면의 시간 표시 — 경과 시간과 '방금 · n분 전'. 모두 서버가 준 ISO 시각에서 계산합니다.
 * 첫 그림(서버 · 하이드레이션)에서는 시계가 없으므로(null) 시간 글자를 비워 둡니다.
 */

/** intervalMs 마다 지금 시각(ms)을 돌려줍니다. 첫 그림에서는 null */
export function useNow(intervalMs = 1000): number | null {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        const tick = () => setNow(Date.now());
        const first = setTimeout(tick, 0);
        const timer = setInterval(tick, intervalMs);
        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };
    }, [intervalMs]);
    return now;
}

function parseTime(iso: string): number | null {
    const time = Date.parse(iso);
    return Number.isFinite(time) ? time : null;
}

/** 예배 시작부터 지난 시간 — '12:48', 한 시간이 넘으면 '1:02:03' */
export function formatElapsed(startedAt: string, now: number | null): string | null {
    const start = parseTime(startedAt);
    if (now === null || start === null) return null;
    const total = Math.max(0, Math.floor((now - start) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** 큐가 온 때 — '방금' · '3분 전' · '2시간 전' · '10월 18일' */
export function relativeTime(iso: string, now: number | null): string {
    const time = parseTime(iso);
    if (now === null || time === null) return '';
    const seconds = Math.floor((now - time) / 1000);
    if (seconds < 45) return '방금';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const date = new Date(time);
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 큐가 온 지 1분이 안 됐는지 (최근 큐 점 색에 씀) */
export function isFresh(iso: string, now: number | null): boolean {
    const time = parseTime(iso);
    return now !== null && time !== null && now - time < 60_000;
}
