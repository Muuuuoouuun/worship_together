/**
 * 플랫폼 및 실행 환경 판별 유틸리티
 */

export function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

/**
 * Capacitor 네이티브 앱(Android/iOS 셸) 내부에서 실행 중인지 여부
 */
export function isNativeApp(): boolean {
    if (!isBrowser()) return false;
    // Capacitor가 주입하는 글로벌 객체 확인
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') {
        return cap.isNativePlatform();
    }
    return false;
}

/**
 * PWA(홈 화면에 추가된 독립 실행형) 모드로 실행 중인지 여부
 */
export function isStandalonePWA(): boolean {
    if (!isBrowser()) return false;
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    return isStandaloneDisplay || isIosStandalone;
}

/**
 * iOS 기기 여부 (iPhone, iPad)
 */
export function isIOS(): boolean {
    if (!isBrowser()) return false;
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    // iPadOS 13+ 데스크톱 모드 감지 (MacIntel이면서 터치 포인트 > 1)
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleDevice || isIpadOS;
}

/**
 * Android 기기 여부
 */
export function isAndroid(): boolean {
    if (!isBrowser()) return false;
    return /android/i.test(window.navigator.userAgent);
}

/**
 * 모바일 또는 태블릿 기기 여부
 */
export function isMobileOrTablet(): boolean {
    if (!isBrowser()) return false;
    return isIOS() || isAndroid() || window.matchMedia('(max-width: 1024px)').matches;
}
