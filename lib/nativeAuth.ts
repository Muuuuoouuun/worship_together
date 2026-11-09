/*
 * 앱 셸(Capacitor Android · iOS) 로그인.
 * Google 은 WebView 로그인을 막으므로(disallowed_useragent) 공급자 로그인은 시스템 브라우저(Custom Tabs · SFSafariViewController)에서 하고,
 * 앱(WebView)은 일회용 코드 + verifier 로 세션 쿠키만 받습니다. 모양은 OAuth PKCE(RFC 7636, S256)와 같습니다.
 *
 *   앱: verifier 생성 → challenge = base64url(SHA-256(verifier)) → 브라우저로 /auth/app-start?challenge=…
 *   브라우저: 핸드오프 쿠키(서명한 {challenge, callbackUrl}) → 공급자 로그인 → /auth/app-complete 가 일회용 코드 발급 · 브라우저 로그아웃
 *             → 앱 링크 /auth/app-return?code=…
 *   앱: POST /api/auth/app-exchange {code, verifier} → 세션 쿠키
 *
 * 여기에는 브라우저와 Node 양쪽에서 도는 순수 함수만 둡니다(WebCrypto · btoa/atob · TextEncoder, node: 모듈 없음).
 * 코드 저장은 lib/server/appLoginCodes.ts, 흐름 · 위협 모델은 docs/android-app-links.md 의 "OAuth in the Android shell".
 */
import { safeLocalCallbackUrl } from './authRedirect';

export const APP_START_PATH = '/auth/app-start';
export const APP_SIGNIN_PATH = '/auth/app-signin';
export const APP_COMPLETE_PATH = '/auth/app-complete';
/** 앱 링크(Android App Links · iOS 유니버설 링크). lib/nativeNav.ts 의 APP_LINK_PATH_PREFIXES 에 들어 있습니다. */
export const APP_RETURN_PATH = '/auth/app-return';
export const APP_EXCHANGE_PATH = '/api/auth/app-exchange';
/** 핸드오프 쿠키와 앱이 보관한 verifier 의 수명 */
export const NATIVE_LOGIN_TTL_MS = 10 * 60 * 1000;
/** 일회용 코드의 수명 */
export const APP_LOGIN_CODE_TTL_MS = 60 * 1000;
/** capacitor.config.ts 의 appId. Android 'intent:' 링크가 이 앱으로만 가게 합니다. */
export const APP_PACKAGE_ID = 'com.worshiptogether.app';
/** 앱(WebView) sessionStorage 에 이번 로그인 시도의 verifier 를 두는 키 */
export const PENDING_LOGIN_KEY = 'wt:native-login';

/** verifier · challenge · 코드: 32바이트를 base64url(패딩 없음)로 쓴 43글자 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PROVIDER_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const HANDOFF_CONTEXT = 'wt-app-handoff.v1';
const encoder = new TextEncoder();

/** http 로 연 개발 서버(에뮬레이터의 10.0.2.2 등)처럼 보안 컨텍스트가 아니라 WebCrypto 를 쓸 수 없을 때 */
export class NativeLoginUnavailableError extends Error {
    constructor() {
        super('이 연결에서는 앱 로그인을 시작할 수 없습니다. https 주소로 연 앱에서 다시 시도해 주세요.');
        this.name = 'NativeLoginUnavailableError';
    }
}

function subtle(): SubtleCrypto {
    const value = globalThis.crypto?.subtle;
    if (!value) throw new NativeLoginUnavailableError();
    return value;
}

export function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
    if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) return null;
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** 무작위 32바이트(256비트) base64url — verifier 와 일회용 코드 */
export function randomToken(): string {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.getRandomValues) throw new NativeLoginUnavailableError();
    return base64UrlEncode(cryptoApi.getRandomValues(new Uint8Array(32)));
}

export function isLoginToken(value: unknown): value is string {
    return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

async function sha256(value: string): Promise<Uint8Array> {
    return new Uint8Array(await subtle().digest('SHA-256', encoder.encode(value)));
}

/** challenge = base64url(SHA-256(verifier)) (RFC 7636 S256) */
export async function challengeFor(verifier: string): Promise<string> {
    return base64UrlEncode(await sha256(verifier));
}

/** 서버에는 코드 대신 이 값(SHA-256 hex)만 저장합니다. */
export async function hashLoginCode(code: string): Promise<string> {
    return Array.from(await sha256(code), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 길이와 상관없이 끝까지 비교합니다(비밀 값 비교에서 어디서 달라지는지 시간으로 새지 않게). */
export function timingSafeEqual(a: string, b: string): boolean {
    let diff = a.length ^ b.length;
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) diff |= (i < a.length ? a.charCodeAt(i) : 0) ^ (i < b.length ? b.charCodeAt(i) : 0);
    return diff === 0;
}

/**
 * 로그인을 마친 앱이 열 화면. safeLocalCallbackUrl 로 다른 사이트 · /api/auth 를 막고,
 * 로그인 화면 · 앱 로그인 경로(/auth/…)로 돌아가 같은 화면을 맴돌지 않게 대시보드로 바꿉니다.
 */
export function appCallbackUrl(value: unknown, origin?: string): string {
    const path = safeLocalCallbackUrl(value, origin);
    let decoded = path;
    try {
        for (let i = 0; i < 4; i += 1) decoded = decodeURIComponent(decoded);
    } catch {
        return '/dashboard';
    }
    return /^\/(?:auth|login)(?:[/?#]|$)/i.test(decoded) ? '/dashboard' : path;
}

/* ───── 핸드오프 쿠키 (브라우저: app-start → app-complete) ───── */

export type HandoffRecord = {
    /** 로그인할 공급자 (google · naver · 개발용 dev) */
    provider: string;
    challenge: string;
    callbackUrl: string;
    /** 만료 시각(ms) */
    exp: number;
};

/** NextAuth 쿠키처럼 https 면 __Secure- 접두사(Secure 필수). Path=/auth 라 __Host- 는 쓸 수 없습니다. */
export function handoffCookieName(secure: boolean): string {
    return `${secure ? '__Secure-' : ''}wt-app-handoff`;
}

async function handoffKey(secret: string): Promise<CryptoKey> {
    return subtle().importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** `base64url(JSON).base64url(HMAC-SHA256(NEXTAUTH_SECRET, 'wt-app-handoff.v1.' + payload))` */
export async function signHandoff(record: HandoffRecord, secret: string): Promise<string> {
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');
    const payload = base64UrlEncode(encoder.encode(JSON.stringify(record)));
    const signature = await subtle().sign('HMAC', await handoffKey(secret), encoder.encode(`${HANDOFF_CONTEXT}.${payload}`));
    return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** 서명이 맞고, 만료되지 않았고, 모든 칸이 올바를 때만 기록을 돌려줍니다. */
export async function verifyHandoff(value: unknown, secret: string, now = Date.now()): Promise<HandoffRecord | null> {
    if (typeof value !== 'string' || !secret || value.length > 2048) return null;
    const parts = value.split('.');
    if (parts.length !== 2 || !parts[0]) return null;
    const signature = base64UrlDecode(parts[1]);
    if (!signature || signature.length !== 32) return null;
    // subtle.verify 가 HMAC 을 상수 시간으로 비교합니다.
    if (!(await subtle().verify('HMAC', await handoffKey(secret), signature, encoder.encode(`${HANDOFF_CONTEXT}.${parts[0]}`)))) return null;
    const bytes = base64UrlDecode(parts[0]);
    if (!bytes) return null;
    let record: unknown;
    try {
        record = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return null;
    }
    if (!record || typeof record !== 'object') return null;
    const { provider, challenge, callbackUrl, exp } = record as Record<string, unknown>;
    if (typeof provider !== 'string' || !PROVIDER_PATTERN.test(provider)) return null;
    if (!isLoginToken(challenge) || typeof callbackUrl !== 'string' || appCallbackUrl(callbackUrl) !== callbackUrl) return null;
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= now) return null;
    return { provider, challenge, callbackUrl, exp };
}

/* ───── 교환 요청 확인 (서버) ───── */

/**
 * 교환 API 는 앱(WebView)이 같은 origin 에서 fetch 로만 부릅니다. 다른 사이트가 보낸 요청(CSRF)은 막습니다.
 * - Origin 머리글이 있어야 하고 허용한 origin(서비스 주소 · 이 요청의 origin) 중 하나여야 합니다.
 * - Sec-Fetch-Site 를 보내는 브라우저라면 same-origin 이어야 합니다.
 */
export function isSameOriginRequest(headers: { origin: string | null; secFetchSite: string | null }, allowedOrigins: readonly (string | null | undefined)[]): boolean {
    if (headers.secFetchSite !== null && headers.secFetchSite !== 'same-origin') return false;
    if (!headers.origin) return false;
    return allowedOrigins.some((origin) => typeof origin === 'string' && origin === headers.origin);
}

/** 앱 로그인 시작(/auth/app-start)은 앱이 연 브라우저(Sec-Fetch-Site: none)나 이 사이트 안에서만. 다른 사이트의 링크로는 시작하지 않습니다. */
export function isAppStartNavigation(secFetchSite: string | null): boolean {
    return secFetchSite === null || secFetchSite === 'none' || secFetchSite === 'same-origin';
}

/* ───── 앱 링크 복귀 ───── */

export function appReturnUrl(origin: string, code: string): string {
    const url = new URL(APP_RETURN_PATH, origin);
    url.searchParams.set('code', code);
    return url.toString();
}

/**
 * Android Chrome 은 같은 사이트 안의 이동 · 리다이렉트를 앱 링크로 넘기지 않을 수 있습니다. 'intent:' 링크는 패키지를 지정해
 * 사용자가 누르면 앱으로 바로 갑니다(앱이 없으면 Play 스토어). https 앱 링크를 같은 경로의 intent 링크로 바꿉니다.
 */
export function androidIntentUrl(httpsUrl: string, packageId = APP_PACKAGE_ID): string | null {
    let url: URL;
    try {
        url = new URL(httpsUrl);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${packageId};end`;
}

/**
 * 앱 링크로 받은 경로(resolveDeepLink 결과)가 로그인 복귀인지. 아니면 null,
 * 복귀 경로인데 코드가 없거나 모양이 틀리면 { code: null }.
 */
export function parseAppReturn(path: string): { code: string | null } | null {
    let url: URL;
    try {
        url = new URL(path, 'https://app.invalid');
    } catch {
        return null;
    }
    if (url.pathname.replace(/\/+$/, '') !== APP_RETURN_PATH) return null;
    const code = url.searchParams.get('code');
    return { code: isLoginToken(code) ? code : null };
}

/* ───── 앱(WebView)이 보관하는 verifier ───── */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type PendingLogin = { verifier: string; expiresAt: number };

/**
 * 앱 로그인 시작: verifier 를 만들어 이번 시도용으로(덮어써서 하나만, 10분) 보관하고, 시스템 브라우저로 열 주소를 돌려줍니다.
 * verifier 는 이 WebView 밖으로 나가지 않습니다. 주소에는 challenge 만 실립니다.
 */
export async function beginNativeLogin({ origin, provider, callbackUrl, storage, now = Date.now() }: {
    origin: string;
    provider: string;
    callbackUrl: string;
    storage: StorageLike;
    now?: number;
}): Promise<string> {
    const verifier = randomToken();
    const challenge = await challengeFor(verifier);
    const pending: PendingLogin = { verifier, expiresAt: now + NATIVE_LOGIN_TTL_MS };
    storage.setItem(PENDING_LOGIN_KEY, JSON.stringify(pending));
    const url = new URL(APP_START_PATH, origin);
    url.searchParams.set('provider', provider);
    url.searchParams.set('challenge', challenge);
    url.searchParams.set('callbackUrl', appCallbackUrl(callbackUrl));
    return url.toString();
}

/** 보관한 verifier 를 꺼냅니다(한 번만 — 꺼내면 지웁니다). 없거나 만료됐으면 null. */
export function takePendingLogin(storage: StorageLike, now = Date.now()): string | null {
    const raw = storage.getItem(PENDING_LOGIN_KEY);
    storage.removeItem(PENDING_LOGIN_KEY);
    if (!raw) return null;
    try {
        const pending = JSON.parse(raw) as Partial<PendingLogin>;
        if (!isLoginToken(pending.verifier) || typeof pending.expiresAt !== 'number' || pending.expiresAt <= now) return null;
        return pending.verifier;
    } catch {
        return null;
    }
}
