import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;
// 에뮬레이터 · 개발용 http 서버일 때만 평문 통신과 혼합 콘텐츠를 허용합니다. https 서버는 둘 다 막습니다.
const insecureServer = serverUrl?.startsWith("http://") ?? false;

const config: CapacitorConfig = {
  appId: "com.worshiptogether.app",
  appName: "Worship Together",
  webDir: "mobile-www",
  backgroundColor: "#FFFFFF",
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: insecureServer,
      }
    : undefined,
  android: {
    allowMixedContent: insecureServer,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
  // iOS 는 ATS(ios/App/App/Info.plist 의 NSAllowsLocalNetworking)가 localhost · LAN 개발 서버만 http 로 허용합니다.
  // Safari 웹 검사기는 Debug 빌드에서만 켜집니다(Capacitor 기본값).
  ios: {
    // 웹 앱이 viewport-fit=cover 와 env(safe-area-inset-*)로 안전 영역을 직접 처리합니다. (Capacitor 기본값과 같지만 명시)
    contentInset: "never",
    // 콘티 · 무대 화면에서 길게 눌러도 링크 미리보기가 뜨지 않게 합니다.
    allowsLinkPreview: false,
  },
};

export default config;
