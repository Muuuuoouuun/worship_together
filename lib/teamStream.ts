import type { TeamEventType } from './server/teamEvents';
import { deviceId } from './pushClient';

/*
 * 팀 소식 실시간 흐름 (브라우저 쪽). 한 탭에서 같은 팀을 여러 화면이 들어도 연결은 하나만 엽니다.
 * 끊기면 브라우저가 3초 뒤 다시 붙고(마지막 소식 번호를 이어서), 서버가 닫아 버리면 여기서 다시 엽니다.
 */

export interface TeamStreamEvent {
    id: number;
    type: TeamEventType;
    // 소식마다 모양이 달라 받는 쪽에서 좁혀 씁니다.
    payload: unknown;
    createdAt: string;
}

export type StreamStatus = 'connecting' | 'online' | 'offline';

type Listener = (event: TeamStreamEvent) => void;
type StatusListener = (status: StreamStatus) => void;

interface Stream {
    source: EventSource | null;
    listeners: Set<Listener>;
    statusListeners: Set<StatusListener>;
    status: StreamStatus;
    lastId: number | null;
    retry: ReturnType<typeof setTimeout> | null;
    failures: number;
}

const streams = new Map<string, Stream>();

function setStatus(stream: Stream, status: StreamStatus) {
    if (stream.status === status) return;
    stream.status = status;
    stream.statusListeners.forEach((listener) => listener(status));
}

function open(teamId: string, stream: Stream) {
    if (typeof EventSource === 'undefined') return;
    stream.source?.close();
    const params = new URLSearchParams();
    if (stream.lastId !== null) params.set('after', String(stream.lastId));
    // 이 기기에서 앱이 열려 있음을 알려, 서버가 이 기기에는 푸시를 보내지 않게 합니다.
    const device = deviceId();
    if (device) params.set('device', device);
    const query = params.toString();
    const source = new EventSource(`/api/teams/${encodeURIComponent(teamId)}/stream${query ? `?${query}` : ''}`);
    stream.source = source;
    setStatus(stream, stream.status === 'online' ? 'online' : 'connecting');
    source.onopen = () => {
        stream.failures = 0;
        setStatus(stream, 'online');
    };
    // 연결되면 서버가 이어 받을 시작 번호를 먼저 보냅니다.
    source.addEventListener('hello', (message) => {
        const id = Number((message as MessageEvent<string>).data);
        if (Number.isFinite(id) && id >= 0) stream.lastId = id;
    });
    source.addEventListener('team', (message) => {
        try {
            const event = JSON.parse((message as MessageEvent<string>).data) as TeamStreamEvent;
            stream.lastId = event.id;
            stream.listeners.forEach((listener) => listener(event));
        } catch {
            // 망가진 한 줄은 건너뜁니다.
        }
    });
    source.onerror = () => {
        setStatus(stream, 'offline');
        // 브라우저가 스스로 다시 붙는 중이면 그대로 두고, 아예 닫혔으면(로그인 만료 · 서버 재시작) 여기서 다시 엽니다.
        if (source.readyState === EventSource.CLOSED && !stream.retry) {
            stream.failures += 1;
            stream.retry = setTimeout(() => {
                stream.retry = null;
                if (stream.listeners.size) open(teamId, stream);
            }, Math.min(30_000, 2_000 * 2 ** Math.min(stream.failures, 4)));
        }
    };
}

/** 같은 팀을 듣는 화면끼리 연결을 나눠 씁니다. 돌려준 함수로 그만 듣습니다. */
export function subscribeTeamStream(teamId: string, listener: Listener, onStatus?: StatusListener): () => void {
    let stream = streams.get(teamId);
    if (!stream) {
        stream = { source: null, listeners: new Set(), statusListeners: new Set(), status: 'connecting', lastId: null, retry: null, failures: 0 };
        streams.set(teamId, stream);
    }
    stream.listeners.add(listener);
    if (onStatus) {
        stream.statusListeners.add(onStatus);
        onStatus(stream.status);
    }
    if (!stream.source) open(teamId, stream);
    const current = stream;
    return () => {
        current.listeners.delete(listener);
        if (onStatus) current.statusListeners.delete(onStatus);
        if (!current.listeners.size) {
            current.source?.close();
            if (current.retry) clearTimeout(current.retry);
            streams.delete(teamId);
        }
    };
}

/** 네트워크가 돌아오면(휴대폰 화면을 다시 켰을 때 등) 기다리지 않고 바로 다시 붙습니다. */
export function reconnectTeamStreams() {
    streams.forEach((stream, teamId) => {
        if (stream.status !== 'online' || stream.source?.readyState === EventSource.CLOSED) {
            if (stream.retry) clearTimeout(stream.retry);
            stream.retry = null;
            open(teamId, stream);
        }
    });
}
