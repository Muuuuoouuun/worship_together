# iOS 앱 셸: 빌드 · 유니버설 링크

Capacitor 8 iOS 셸(`ios/`)은 Android 셸과 같이 `CAPACITOR_SERVER_URL`의 Next.js 서버를 WKWebView로 불러옵니다. 앱 링크 처리 코드(`components/app/NativeBridge.tsx`, `lib/nativeNav.ts`)도 같이 씁니다. 뒤로가기 키 · App Links · 앱 셸 로그인(OAuth) 흐름은 [Android 앱 셸 문서](android-app-links.md)를 봅니다. iOS에서 다른 점은 아래 "로그인"에 있습니다.

| 파일 | 역할 |
| --- | --- |
| `ios/App/App.xcodeproj` | Xcode 프로젝트. CocoaPods 없이 Swift Package Manager(SPM)를 씁니다(Capacitor 8 기본값). |
| `ios/App/CapApp-SPM/Package.swift` | `npx cap sync ios`가 다시 씁니다. 손으로 고치지 않습니다. 플러그인(`@capacitor/app`, `@capacitor/browser`)은 `node_modules`를 가리키므로 `npm ci` 뒤에 빌드합니다. |
| `ios/App/App/Info.plist` | 표시 이름, 개발 지역 `ko`, 암호화 신고, ATS, 회전 방향 |
| `ios/App/App/App.entitlements` | 유니버설 링크 `applinks:$(APP_LINK_HOST)` |
| `.github/workflows/ios-build.yml` | macOS에서 서명 없이 시뮬레이터 빌드 · 실행 · 스크린샷 |

`cap sync ios`가 만드는 `ios/App/App/public`, `capacitor.config.json`, `config.xml`, `ios/capacitor-cordova-ios-plugins`는 커밋하지 않습니다(`ios/.gitignore`).

## 빌드

macOS와 Xcode 26 이상이 필요합니다(Capacitor 8 요구 사항). 최소 iOS는 15.0입니다.

```bash
npm ci
CAPACITOR_SERVER_URL=https://worship.example.org npm run mobile:sync:ios
npm run mobile:open:ios   # Xcode: Signing & Capabilities 에서 Team 을 고른 뒤 실행
```

- **시뮬레이터 + 로컬 개발 서버:** `CAPACITOR_SERVER_URL=http://localhost:4000`. 시뮬레이터는 Mac의 네트워크를 같이 씁니다.
- **실제 기기 + 개발 서버:** Mac의 LAN 주소(`http://192.168.x.x:4000`)를 씁니다. 처음 연결할 때 iOS가 로컬 네트워크 접근 권한을 묻습니다.
- **서명 없는 명령줄 빌드(CI와 같음):**

  ```bash
  xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO build
  ```

서명 · TestFlight · App Store 배포는 아직 설정하지 않았습니다.

## 설정

- **`Info.plist`**
  - `CFBundleDisplayName`: `Worship Together`(`capacitor.config.ts`의 `appName`)
  - `CFBundleDevelopmentRegion`: `ko`. 앱에 다른 언어 리소스가 없으므로 날짜 선택 · 복사 메뉴 같은 시스템 UI는 이 언어를 따릅니다.
  - `ITSAppUsesNonExemptEncryption`: `false`. 표준 HTTPS만 씁니다.
  - `NSAppTransportSecurity`: `NSAllowsLocalNetworking`만 켭니다. http는 `localhost` 같은 점 없는 호스트, `*.local`, IP 주소에만 허용되고, 그 밖의 http 주소는 막힙니다. `NSAllowsArbitraryLoads`는 쓰지 않습니다(CI가 확인).
  - 회전: iPhone · iPad 모두 세로 · 가로. 무대 화면을 보면대에 가로로 둡니다.
- **`capacitor.config.ts`의 `ios`**
  - `contentInset: "never"`: 웹 앱이 `viewport-fit=cover`와 `env(safe-area-inset-*)`로 안전 영역을 직접 처리합니다.
  - `allowsLinkPreview: false`: 길게 눌러도 링크 미리보기가 뜨지 않습니다.
  - Safari 웹 검사기는 Debug 빌드에서만 켜집니다(Capacitor 기본값).
- **뒤로가기:** iOS에는 뒤로가기 키가 없습니다. `NativeBridge`는 `backButton` 리스너를 Android에서만 붙입니다. 가장자리 스와이프로 뒤로 가기(`WKWebView.allowsBackForwardNavigationGestures`)는 Capacitor 설정에 없는 옵션이라 켜지 않았습니다. 켜려면 `CAPBridgeViewController`를 상속해 `capacitorDidLoad()`에서 켜고, `Main.storyboard`의 클래스를 바꿔야 합니다.

## 유니버설 링크

Android App Links와 같은 경로(`lib/nativeNav.ts`의 `APP_LINK_PATH_PREFIXES`)를 앱에서 엽니다. 앱 로그인 복귀 `/auth/app-return`도 여기에 들어 있습니다. 링크가 오면 `AppDelegate`가 `@capacitor/app`의 `appUrlOpen`으로 넘기고, `NativeBridge`가 Android와 같은 원점 · 경로 확인을 거쳐 `router.push`로 엽니다.

### 설정

1. **호스트:** 빌드 설정 `APP_LINK_HOST`로 정합니다. 기본값은 예약 도메인 `worship-together.example`이라 검증되지 않습니다. 값에는 호스트만 적습니다.

   ```bash
   xcodebuild ... APP_LINK_HOST=worship.example.org   # 또는 Xcode → Build Settings → User-Defined → APP_LINK_HOST
   ```

2. **서명:** Associated Domains는 유료 Apple Developer 팀으로 서명할 때만 적용됩니다. Xcode 자동 서명에서 Team을 고르면 App ID에 기능이 켜집니다. 서명하지 않은 시뮬레이터 빌드(CI)는 entitlements를 적용하지 않으므로 링크도 앱으로 오지 않습니다.
3. **웹 서버:** 셸이 부르는 서버 원점과 링크 호스트가 다르면 Android와 같이 `NEXT_PUBLIC_APP_LINK_HOST`를 설정합니다.

### `apple-app-site-association`

팀 ID가 필요하므로 저장소에는 두지 않습니다. 배포할 때 `ABCDE12345`를 Apple Developer 팀 ID로 바꿔 올립니다. `tests/nativeNav.test.ts`가 아래 경로 목록이 `APP_LINK_PATH_PREFIXES`와 같은지 확인합니다.

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.worshiptogether.app"],
        "components": [
          { "/": "/invite/?*" },
          { "/": "/session/?*" },
          { "/": "/live/?*" },
          { "/": "/dashboard" },
          { "/": "/dashboard/*" },
          { "/": "/auth/app-return" },
          { "/": "/auth/app-return/*" }
        ]
      }
    ]
  }
}
```

- `?*`는 한 글자 이상입니다. 토큰 없는 `/invite/`나 `/dashboardx`는 앱으로 보내지 않습니다. 앱이 열렸는데 `NativeBridge`가 무시하는 링크가 생기지 않게, 앱이 받는 범위와 똑같이 맞췄습니다.
- **올리는 곳:** `https://<APP_LINK_HOST>/.well-known/apple-app-site-association`(확장자 없음)
  - 응답은 `200`이어야 하고, 리다이렉트가 없어야 하고, `Content-Type: application/json`이어야 합니다.
  - Next.js에서는 `public/.well-known/apple-app-site-association`에 두고, `next.config.ts`의 `headers()`로 이 경로에 `Content-Type: application/json`을 붙입니다.
- **확인:**
  - `curl -sSI https://worship.example.org/.well-known/apple-app-site-association`
  - Apple CDN이 받아 간 내용: `curl -sS https://app-site-association.cdn-apple.com/a/v1/worship.example.org`

## 로그인

Android와 같은 흐름입니다. 공급자 로그인은 `@capacitor/browser`가 띄운 `SFSafariViewController`에서 하고, 앱은 일회용 코드와 `verifier`로 WKWebView 세션을 받습니다. 흐름 · 위협 모델 · 테스트는 [Android 앱 셸 문서의 "OAuth in the Android shell"](android-app-links.md#oauth-in-the-android-shell)에 있습니다. `npx cap sync ios`가 `CAPBrowserPlugin`을 `capacitor.config.json`의 `packageClassList`에, `CapacitorBrowser`를 `CapApp-SPM/Package.swift`에 넣습니다.

iOS에서 다른 점은 다음과 같습니다.

- **쿠키:** iOS 11부터 `SFSafariViewController`는 Safari와 쿠키를 같이 쓰지 않습니다. 그래서 `app-complete`의 브라우저 로그아웃은 그 창 안의 세션만 지우고, Safari에서 웹으로 로그인한 상태에는 영향이 없습니다.
- **복귀 위험(기기 미확인):** Apple은 사용자가 다른 도메인의 링크를 직접 눌렀을 때만 유니버설 링크로 앱을 엽니다. 같은 도메인 안의 이동과 서버 리다이렉트로는 열지 않습니다.
  - 그래서 `app-complete`의 303 리다이렉트는 앱 대신 `/auth/app-return` 화면을 그 창에 열 가능성이 큽니다.
  - 그 화면의 "앱으로 돌아가기"(같은 도메인 링크)도 앱을 열지 못할 수 있습니다.
  - 기기에서 막히면 다음 중 하나로 바꿉니다.
    1. 복귀 링크만 다른 호스트(예: `app.worship.example.org`)로 보내고, 그 호스트를 Associated Domains와 AASA에 넣습니다.
    2. `ASWebAuthenticationSession`(iOS 17.4+의 https 콜백, 또는 커스텀 스킴)으로 띄우는 플러그인을 씁니다. 코드 · `verifier` 교환 API는 그대로 씁니다.

**미확인:**
- 실제 기기 · 서명 빌드 · 유니버설 링크 검증은 해 보지 않았습니다. CI는 서명 없는 시뮬레이터 빌드와 실행만 확인합니다.
- 위의 로그인 복귀(`SFSafariViewController` → 앱)는 실제 기기와 실제 Google · 네이버 계정으로 확인해야 합니다.
- 앱 셸(WKWebView)은 웹 푸시를 받지 못합니다. iPhone 웹 푸시는 홈 화면에 추가한 웹 앱에서만 옵니다.

## CI 결과

| 실행 | 날짜 | 결과 |
| --- | --- | --- |
| [iOS build #1](https://github.com/Muuuuoouuun/worship_together/actions/runs/42635872758) | 2026-11-09 | 전 단계 통과. Xcode 26 확인, SPM resolve, 서명 없는 시뮬레이터 빌드 약 50초, 시뮬레이터 설치 · 실행, 30초 뒤 스크린샷에서 오늘 화면 렌더 확인 |

| #2 | 2026-11-09 | 다음 푸시로 취소 (동시 실행 방지 동작 확인) |
| #3 | 2026-11-09 | 빌드 통과(Browser 플러그인 포함), 첫 부팅 직후 `simctl install` 이 5분 넘게 멈춤 → 명령별 감시 · 재시도 추가 |
| #4 | 2026-11-09 | 설치 통과, 일반 `simctl launch` 가 두 번 멈춤 → 대조군 · 콘솔 캡처 · 크래시 로그 수집 추가 |
| #5 | 2026-11-09 | 앱 · 대조군 모두 정상 실행. 콘솔을 프로세스 확인보다 먼저 끊어 앱이 함께 종료된 워크플로 순서 오류, 앱 콘솔에 연결 코드 ChunkLoadError |
| [#6](https://github.com/Muuuuoouuun/worship_together/actions/runs/42650997072) | 2026-11-09 | 전 단계 통과. 연결 코드 동적 로딩 재시도 반영, 앱 콘솔에 오류 없음, 60초 화면 정상(헤더가 상태바 아래) |

남은 일: 브랜드 앱 아이콘(1024px, 불투명) · 스플래시 교체, 서명 · TestFlight, 실제 도메인의 유니버설 링크 검증, 셸 푸시(APNs).
