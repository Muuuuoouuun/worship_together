# Android 앱 셸: 뒤로가기 · 앱 링크 · OAuth 로그인

Capacitor 8 Android 셸(`android/`)은 `CAPACITOR_SERVER_URL`의 Next.js 서버를 WebView로 불러옵니다. 이 문서는 셸에서만 동작하는 세 가지를 다룹니다.

- 뒤로가기 키 처리
- 초대 · 세션 · 라이브 · 대시보드 링크를 앱에서 여는 Android App Links
- 앱 셸 로그인: 공급자 로그인은 시스템 브라우저에서 하고, 앱은 일회용 코드로 세션을 받습니다(iOS 셸도 같음)

iOS 셸의 빌드 · 설정 · 유니버설 링크(`apple-app-site-association`)는 [iOS 앱 셸 문서](ios-app.md)에 있습니다. 앱 링크 처리 코드와 허용 경로는 두 플랫폼이 같이 씁니다.

관련 코드는 다음과 같습니다.

| 파일 | 역할 |
| --- | --- |
| `components/app/NativeBridge.tsx` | 루트 레이아웃에 한 번 붙습니다. 네이티브일 때만 `@capacitor/app`을 동적으로 불러옵니다. |
| `lib/nativeNav.ts` | 뒤로가기 판단(`backAction`), 앱 링크 경로 변환(`resolveDeepLink`), 허용 경로 목록. 테스트는 `tests/nativeNav.test.ts`에 있습니다. |
| `android/app/src/main/AndroidManifest.xml` | `autoVerify` App Links `intent-filter`가 있습니다. 호스트는 `${appLinkHost}` 자리표시자입니다. |
| `android/app/build.gradle` | `APP_LINK_HOST`를 읽어 `appLinkHost` 자리표시자를 채웁니다. |
| `capacitor.config.ts` | `allowMixedContent`와 `cleartext`는 `http://` 서버(에뮬레이터 · 개발)일 때만 켜집니다. |
| `lib/nativeAuth.ts`, `lib/server/appLoginCodes.ts` | 앱 셸 로그인(아래 "OAuth in the Android shell"). 테스트는 `tests/nativeAuth.test.ts`, `tests/e2e/native-login.spec.ts`에 있습니다. |

## 뒤로가기 키

| 상황 | 동작 |
| --- | --- |
| 모달 · 시트(`aria-modal="true"`)가 열려 있음 | `document`에 Escape keydown을 보내 맨 위 창만 닫습니다. 공통 `Modal`, `useSheetDismiss`, 라이브 시트가 모두 이 방식으로 닫힙니다. |
| 시작 화면(`/`, `/dashboard`, `/login`) | 첫 누름에 "한 번 더 누르면 앱을 닫아요" 안내(`role="status"`)를 띄웁니다. 2초 안에 다시 누르면 `App.exitApp()`으로 닫습니다. |
| 그 밖의 화면, WebView에 돌아갈 기록이 있음 | `window.history.back()` |
| 그 밖의 화면, 돌아갈 기록이 없음(앱 링크로 바로 연 화면 등) | `/dashboard`로 이동(`router.replace`) |

시작 화면에서는 돌아갈 기록이 있어도 이전 화면으로 가지 않습니다. 로그인 · 로그아웃 뒤의 WebView 기록에는 로그인 화면이나 다시 넘겨 주는 주소(OAuth 콜백, 보호된 화면)가 남습니다. 거기로 돌아가면 같은 화면을 맴돌아 앱을 닫을 수 없습니다. Android의 "시작 화면에서 뒤로 = 앱 종료" 관례도 따릅니다.

## Android App Links

### 설정

1. 호스트를 정합니다. 초대 링크는 `NEXTAUTH_URL`의 원점으로 만들어지므로 그 호스트(예: `worship.example.org`)를 씁니다. 운영 셸의 `CAPACITOR_SERVER_URL`도 같은 원점이어야 합니다.
2. 빌드할 때 넘깁니다. 우선순위는 다음과 같습니다.

   ```bash
   cd android
   ./gradlew assembleRelease -PAPP_LINK_HOST=worship.example.org   # 1) Gradle 속성
   # 2) android/gradle.properties 에 APP_LINK_HOST=worship.example.org
   # 3) 환경 변수: APP_LINK_HOST=worship.example.org ./gradlew assembleRelease
   ```

   지정하지 않으면 예약 도메인 `worship-together.example`가 들어갑니다. 이 기본값은 검증되지 않으므로 링크가 앱으로 오지 않습니다. 값에는 호스트만 적습니다. `https://`, 포트, 경로가 있으면 빌드가 실패합니다.
3. 웹 서버 쪽에서는 선택 사항입니다. 앱 링크 호스트가 셸이 불러오는 서버 원점과 다를 때만 `NEXT_PUBLIC_APP_LINK_HOST=worship.example.org`를 설정합니다. 예를 들어 에뮬레이터가 `http://10.0.2.2:4000`을 부르는데 링크는 공개 호스트인 경우입니다. 이 값을 설정하면 `NativeBridge`는 그 호스트의 링크도 지금 불러온 서버의 같은 경로로 엽니다. 이 값은 빌드할 때 번들에 들어가므로, 바꾼 뒤에는 서버를 다시 빌드하거나 재시작합니다.

### 앱에서 여는 경로

`intent-filter`와 `lib/nativeNav.ts`의 `APP_LINK_PATH_PREFIXES`가 같은 목록을 씁니다. 테스트가 두 목록이 같은지 확인합니다.

- `/invite/…` 초대
- `/session/…` 예배 세션
- `/live/…` 라이브(`/live/start`, `/live/[sessionId]`)
- `/dashboard`와 그 아래 경로(푸시 알림 · 공지 링크)
- `/auth/app-return` 앱 셸 로그인 복귀. `NativeBridge`가 화면 이동 대신 코드 교환으로 처리합니다(아래 OAuth 절).

앱이 켜져 있으면 `appUrlOpen`이 오고, `NativeBridge`가 같은 원점인지와 허용 경로인지를 확인한 뒤 `router.push`로 엽니다. 앱이 꺼져 있을 때 링크로 열면 WebView는 서버 첫 화면을 불러옵니다. Capacitor는 첫 리스너가 붙을 때까지 이벤트를 보관하므로, 리스너가 붙는 대로 그 링크 화면으로 이동합니다. Activity는 `exported="true"`라 다른 앱이 아무 주소나 보낼 수 있습니다. 그래서 다른 호스트, `javascript:` 같은 스킴, 목록 밖의 경로는 무시합니다.

### `assetlinks.json`

이 파일에는 실제 서명 인증서 지문이 필요하므로 저장소의 `public/`에는 두지 않습니다. 배포할 때 아래 형식으로 만듭니다.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.worshiptogether.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

- **올리는 곳:** `https://<APP_LINK_HOST>/.well-known/assetlinks.json`
  - 응답은 `200`과 `Content-Type: application/json`이어야 하고, 리다이렉트가 없어야 합니다. Next.js에서는 `public/.well-known/assetlinks.json`에 두면 그대로 제공됩니다.
  - 지문은 비밀이 아니므로, 확정되면 커밋해도 됩니다.
- **지문 구하는 곳:** 쓰는 서명 키마다 하나씩 넣습니다. 여러 개를 넣을 수 있습니다.
  - 디버그 키: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`의 `SHA256:` 줄
  - 업로드 · 릴리스 키: `keytool -list -v -keystore <release.jks> -alias <alias>`
  - 빌드된 APK: `$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs app-release.apk`의 `SHA-256 digest`. 콜론 없는 소문자로 나오므로 두 글자씩 콜론으로 잇고 대문자로 바꿉니다.
  - Play 앱 서명: Play Console → 앱 무결성 → 앱 서명 키 인증서의 SHA-256. Play에서 받은 설치본은 이 키로 서명됩니다.

### 확인

```bash
# 1) 서버: 200 · application/json · 리다이렉트 없음
curl -sSI https://worship.example.org/.well-known/assetlinks.json
# Google Digital Asset Links API 로 문장 확인
curl -sS "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://worship.example.org&relation=delegate_permission/common.handle_all_urls"

# 2) 기기 (Android 12+)
adb shell pm verify-app-links --re-verify com.worshiptogether.app
adb shell pm get-app-links com.worshiptogether.app      # worship.example.org: verified 이어야 함
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE \
  -d "https://worship.example.org/invite/TOKEN"          # 앱이 초대 화면으로 열려야 함
```

검증 전에 개발하는 방법도 있습니다. 패키지를 지정해 보내면 검증 없이 앱으로 갑니다. 에뮬레이터 빌드에서는 dev 서버를 `NEXT_PUBLIC_APP_LINK_HOST=worship-together.example`로 띄운 뒤 다음을 실행합니다.

```bash
adb shell am start -a android.intent.action.VIEW -d "https://worship-together.example/invite/TOKEN" com.worshiptogether.app
```

검증되지 않은 호스트는 설정 → 앱 → Worship Together → 기본으로 열기 → 링크 추가에서 사용자가 직접 켤 수도 있습니다(`adb shell pm set-app-links-user-selection --user cur --package com.worshiptogether.app true <host>`).

**미확인:**
- 실제 기기에서의 뒤로가기 · 링크 동작은 아직 확인하지 않았습니다. 에뮬레이터 없이 빌드와 병합된 매니페스트만 확인했습니다.
- 카카오톡 인앱 브라우저에서 연 초대 링크가 App Links로 앱에 넘어오는지도 확인하지 않았습니다.

## OAuth in the Android shell

iOS 셸도 같은 코드와 흐름을 씁니다. iOS에서 다른 점은 [iOS 앱 셸 문서](ios-app.md)의 "로그인"에 있습니다.

### 왜 시스템 브라우저인가

- **Google은 임베디드 WebView 로그인을 막습니다.** `disallowed_useragent`(403)를 돌려줍니다. 시스템 브라우저나 Custom Tabs를 쓰라고 안내합니다. 네이버도 앱에서는 외부 브라우저나 SDK를 권장합니다.
- **Capacitor는 `server.allowNavigation`에 없는 호스트를 외부 브라우저로 넘깁니다.** 그래서 WebView에서 `signIn('google')`을 부르면 state · PKCE 쿠키는 WebView에, 공급자 왕복은 Chrome에서 일어나 `OAuthCallback` 오류로 끝납니다. 성공하더라도 세션 쿠키는 Chrome에 생깁니다.

그래서 공급자 로그인은 시스템 브라우저(`@capacitor/browser`: Android Custom Tabs, iOS `SFSafariViewController`)에서 하고, WebView는 PKCE(RFC 7636 S256)와 같은 모양의 일회용 코드 교환으로 세션 쿠키만 받습니다. 공급자 콘솔의 리디렉션 URI(`/api/auth/callback/<provider>`)는 바꾸지 않습니다.

### 흐름

1. **앱(WebView): 로그인 버튼.** `LoginButtons`는 `isNativeApp()`일 때 `signIn()` 대신 `beginNativeLogin()`을 부릅니다.
   - `verifier`(무작위 32바이트, base64url)와 `challenge = base64url(SHA-256(verifier))`를 WebCrypto로 만듭니다.
   - `verifier`는 이번 시도용으로 `sessionStorage`(`wt:native-login`, 10분, 덮어써서 하나만)에 둡니다. WebView 밖으로 나가지 않습니다.
   - `Browser.open({ url: <origin>/auth/app-start?provider=<id>&challenge=<c>&callbackUrl=<로컬 경로> })`로 시스템 브라우저를 엽니다.
2. **브라우저 `GET /auth/app-start`** (`app/auth/app-start/route.ts`)
   - 공급자가 켜져 있는지, `challenge` 모양(43글자 base64url)이 맞는지 확인합니다. 다른 사이트의 링크(`Sec-Fetch-Site: cross-site`/`same-site`)로는 시작하지 않습니다.
   - `{provider, challenge, callbackUrl, exp}`를 `NEXTAUTH_SECRET`로 HMAC-SHA256 서명한 핸드오프 쿠키를 설정합니다. 쿠키는 `(__Secure-)wt-app-handoff`, 10분, httpOnly, SameSite=Lax, https면 Secure, `Path=/auth`입니다.
   - `/auth/app-signin`으로 303 리다이렉트합니다.
3. **브라우저 `/auth/app-signin`** (`app/auth/app-signin/page.tsx`)
   - 핸드오프 쿠키가 있을 때만 그 공급자의 NextAuth 로그인을 `callbackUrl=/auth/app-complete`로 시작합니다. NextAuth v4는 CSRF 토큰과 POST가 필요해서 서버 리다이렉트 대신 이 화면이 `signIn()`을 부릅니다.
   - 이 브라우저에 이미 로그인돼 있어도 앱에서 고른 공급자로 다시 로그인합니다. 다른 계정으로 앱에 들어가지 않게 하기 위해서입니다.
   - 개발용 이름 로그인(`DEV_LOGIN=1`)은 같은 화면에 이름 입력란을 보여 줍니다. e2e가 이 경로를 씁니다.
4. **공급자 OAuth.** 기존 `/api/auth/callback/<provider>`가 브라우저 쿠키 저장소에서 처리합니다.
5. **브라우저 `GET /auth/app-complete`** (`app/auth/app-complete/route.ts`)
   - 브라우저 세션(`getCurrentUser`)과 서명한 핸드오프 쿠키를 확인합니다. 핸드오프 쿠키가 없으면 앱이 시작한 로그인이 아니므로 브라우저 로그인을 건드리지 않고 안내 화면으로 보냅니다.
   - 일회용 코드(무작위 32바이트)를 발급합니다. SQLite에는 코드의 SHA-256 해시만 둡니다(60초, `writeTransaction`). 만료된 코드는 이때 함께 지웁니다.
   - 핸드오프 쿠키를 지우고, 이 응답에서 NextAuth 세션 쿠키(나뉜 조각 포함)를 만료시켜 브라우저를 로그아웃시킵니다.
   - 앱 링크 `https://<요청 origin>/auth/app-return?code=<code>`로 303 리다이렉트합니다. 본문에는 리다이렉트를 따르지 않는 브라우저용 "앱으로 돌아가기" 링크가 있습니다.
6. **앱 링크 `/auth/app-return`**
   - 앱으로 열리면 `NativeBridge`가 `appUrlOpen`에서 일반 이동보다 먼저 이 경로를 확인합니다. 보관한 `verifier`를 꺼내고(한 번만), `Browser.close()` 뒤 같은 origin으로 `POST /api/auth/app-exchange {code, verifier}`를 보냅니다.
   - 성공하면 돌려받은 `callbackUrl`로 `location.replace`(전체 새로고침)해서 서버 화면이 새 쿠키로 그려지게 합니다. 실패하면 하단 안내에 한국어 메시지를 6초 띄웁니다.
   - 브라우저에서 열리면 `app/auth/app-return/page.tsx`가 "앱에서 열어 주세요"와 "앱으로 돌아가기" 버튼을 보여 줍니다. 이 화면은 코드를 교환하지 않습니다. Android에서는 Chrome이 같은 사이트 안의 링크를 앱으로 넘기지 않을 수 있어, 버튼이 패키지를 지정한 `intent://…#Intent;scheme=https;package=com.worshiptogether.app;end` 링크입니다.
7. **서버 `POST /api/auth/app-exchange`** (`app/api/auth/app-exchange/route.ts`)
   - 같은 origin 요청만 받습니다. `Origin`이 서비스 주소나 요청 origin과 같아야 하고, `Sec-Fetch-Site`를 보내면 `same-origin`이어야 합니다. 아니면 403이며, 이때는 코드를 조회하지 않습니다. `Content-Type: application/json`만 받습니다.
   - 쓰기 트랜잭션 하나(BEGIN IMMEDIATE)에서 처리합니다. 코드 해시를 조회하고, 만료 · 사용 여부를 확인하고, 사용 표시(`UPDATE … WHERE used_at IS NULL`)를 한 뒤, `SHA-256(verifier)`와 `challenge`를 상수 시간으로 비교합니다.
   - 성공하면 `next-auth/jwt`의 `encode()`로 `jwt` 콜백과 같은 클레임(`sessionTokenClaims`: `sub`, `userId`, `name`, `email`, `picture`)의 토큰을 만듭니다. NextAuth와 같은 이름 · 속성의 쿠키를 설정합니다. https면 `__Secure-next-auth.session-token`, http면 `next-auth.session-token`이고, httpOnly, SameSite=Lax, `Path=/`, `SESSION_MAX_AGE`(30일)입니다.
   - `{ ok: true, callbackUrl }`을 돌려줍니다.

**저장:** `app_login_codes(code_hash TEXT PRIMARY KEY, user_id, name, email, picture, challenge, callback_url, expires_at INTEGER, used_at INTEGER)`와 `expires_at` 인덱스입니다. 같은 SQLite 파일(`TEAM_DATABASE_PATH`)에 둡니다. `name` · `email` · `picture`는 교환 때 `jwt` 콜백과 같은 토큰을 만들기 위해 둡니다.

### 위협 모델

- **다른 앱이 코드를 가로챔:** 앱 링크 · 로그 · 다른 앱으로 코드가 새도 `verifier` 없이는 쓸 수 없습니다. `verifier`는 WebView `sessionStorage`에만 있고, 브라우저와 주소에는 `challenge`만 실립니다.
- **재사용(replay):** 코드는 256비트, 60초, 한 번만 쓸 수 있습니다. 조회와 사용 표시가 한 쓰기 트랜잭션이라 동시에 두 번 교환해도 하나만 성공합니다. 서버 프로세스가 둘이어도 같습니다(테스트: 스레드 4개, 연결 4개). 서버에는 해시만 남습니다.
- **브라우저에 남는 로그인:** `app-complete`가 코드를 발급하는 응답에서 브라우저 세션 쿠키를 만료시킵니다. 핸드오프 쿠키도 지웁니다. Android Custom Tabs는 Chrome과 쿠키를 같이 쓰므로, Chrome에서 웹으로 로그인해 있던 사람도 앱 로그인 뒤에는 Chrome에서 로그아웃됩니다.
- **열린 리디렉트:** `callbackUrl`은 `app-start`, 서명 검증, 저장, 교환 응답, 앱에서 이동할 때마다 `safeLocalCallbackUrl` 기반 `appCallbackUrl`로 다시 거릅니다. 다른 사이트, `//`, 역슬래시, `/api/auth`, `/auth/…`, `/login`은 `/dashboard`로 바꿉니다.
- **교환 API CSRF:** 위의 `Origin` · `Sec-Fetch-Site` 확인과 JSON 본문 요구로 막습니다. 403일 때는 코드를 조회하지 않으므로, 다른 사이트의 요청이 앱의 코드를 태울 수도 없습니다.

**정한 것:**
- **틀린 `verifier`도 코드를 써 버립니다.** 코드를 가로챈 쪽이 `verifier`를 여러 번 맞혀 볼 수 없고, 서버가 시도 횟수를 따로 셀 필요도 없습니다. 대가는, 남이 먼저 틀린 값으로 코드를 태우면 진짜 앱이 로그인을 다시 시작해야 한다는 점입니다. 이는 서비스 거부일 뿐 탈취는 아닙니다. 시도 횟수 제한은 이번 범위에 넣지 않았습니다.
- **다른 사이트 링크로는 시작하지 않습니다.** 공격자가 피해자 브라우저에서 `app-start`를 열게 해도(`Sec-Fetch-Site: cross-site`), 핸드오프 쿠키를 만들지 않습니다. 이 확인이 없더라도 코드는 피해자 브라우저 주소에만 남습니다. `app-return` · `app-signin` · `app-complete`는 `Referrer-Policy: no-referrer`이고, 서비스 워커도 `/auth/` 화면을 보관하지 않습니다.
- **`verifier`는 `sessionStorage`에 둡니다.** Custom Tab이 떠 있는 동안 Android가 메모리 부족으로 앱 프로세스를 끝내면 `verifier`가 사라집니다. 이 경우 앱은 "로그인 요청이 만료되었어요"를 띄우고, 사용자는 다시 로그인해야 합니다.

### 확인한 것과 못 한 것

- **자동 검사:**
  - `tests/nativeAuth.test.ts`: RFC 7636 예시 값, 핸드오프 쿠키 변조 · 만료, 한 번만 사용, 틀린 `verifier`, 만료, 스레드 4개 동시 교환, NextAuth가 교환 토큰을 실제 로그인처럼 읽는지
  - `tests/e2e/native-login.spec.ts`: 브라우저 컨텍스트와 WebView 컨텍스트를 나눠 개발용 로그인으로 전체 흐름. 브라우저 로그아웃, WebView 로그인, 재사용 · 틀린 `verifier` · 다른 origin(403) 거절을 확인합니다.
- **기기에서 확인하지 못한 것:** 실제 Google · 네이버 계정, 실제 기기, 검증된 App Links가 필요합니다.
  - Custom Tab 안의 303 리다이렉트가 앱 링크로 앱을 여는지. 안 열리면 "앱으로 돌아가기"(`intent:`) 버튼으로 돌아옵니다.
  - `singleTask` 액티비티가 앞으로 올 때 Custom Tab이 정리되는지
  - 네이버 로그인 화면이 Custom Tab에서 자동 로그인 · 동의를 어떻게 보여 주는지
