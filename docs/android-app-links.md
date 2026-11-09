# Android 앱 셸: 뒤로가기 · 앱 링크 · OAuth 설계

Capacitor 8 Android 셸(`android/`)은 `CAPACITOR_SERVER_URL`의 Next.js 서버를 WebView로 불러옵니다. 이 문서는 셸에서만 동작하는 세 가지를 다룹니다.

- 뒤로가기 키 처리
- 초대 · 세션 · 라이브 · 대시보드 링크를 앱에서 여는 Android App Links
- OAuth 로그인 설계(아직 구현하지 않음)

iOS 셸의 빌드 · 설정 · 유니버설 링크(`apple-app-site-association`)는 [iOS 앱 셸 문서](ios-app.md)에 있습니다. 앱 링크 처리 코드와 허용 경로는 두 플랫폼이 같이 씁니다.

관련 코드는 다음과 같습니다.

| 파일 | 역할 |
| --- | --- |
| `components/app/NativeBridge.tsx` | 루트 레이아웃에 한 번 붙습니다. 네이티브일 때만 `@capacitor/app`을 동적으로 불러옵니다. |
| `lib/nativeNav.ts` | 뒤로가기 판단(`backAction`), 앱 링크 경로 변환(`resolveDeepLink`), 허용 경로 목록. 테스트는 `tests/nativeNav.test.ts`에 있습니다. |
| `android/app/src/main/AndroidManifest.xml` | `autoVerify` App Links `intent-filter`가 있습니다. 호스트는 `${appLinkHost}` 자리표시자입니다. |
| `android/app/build.gradle` | `APP_LINK_HOST`를 읽어 `appLinkHost` 자리표시자를 채웁니다. |
| `capacitor.config.ts` | `allowMixedContent`와 `cleartext`는 `http://` 서버(에뮬레이터 · 개발)일 때만 켜집니다. |

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

## OAuth in the Android shell (설계, 미구현)

### 지금 막히는 이유

- **Google은 임베디드 WebView 로그인을 막습니다.** `disallowed_useragent`(403)를 돌려줍니다. WebView는 앱이 입력과 쿠키를 들여다볼 수 있는 환경이라, 2016년 발표 이후 정책상 차단합니다. Google은 시스템 브라우저나 Custom Tabs를 쓰라고 안내합니다. 네이버도 앱에서는 외부 브라우저나 SDK를 권장합니다.
- **Capacitor 기본 동작도 같은 결과를 냅니다(코드 기준 추정, 기기 미확인).** `Bridge.launchIntent`는 `server.allowNavigation`에 없는 호스트로의 이동을 외부 브라우저로 넘깁니다. 그래서 `signIn('google')`이 `accounts.google.com`으로 가는 순간 Chrome이 열립니다.
  - NextAuth의 state · PKCE · CSRF 쿠키는 WebView 쿠키 저장소에 있으므로 Chrome에서 받은 콜백은 `OAuthCallback` 오류로 끝납니다.
  - 콜백이 성공하더라도 세션 쿠키는 Chrome에 생기고 WebView에는 생기지 않습니다.
  - `allowNavigation`에 Google 호스트를 넣어 WebView 안에서 열면 위 403을 받습니다.

### 제안 흐름

공급자 로그인은 Custom Tabs(실제 브라우저)에서 하고, WebView는 일회용 코드로 세션만 받습니다.

1. **WebView: 검증값 만들기.** 로그인 버튼(네이티브일 때만)이 `verifier`(무작위 32바이트, base64url)를 만들어 메모리나 `sessionStorage`에 둡니다. `challenge = base64url(SHA-256(verifier))`입니다.
2. **WebView → Custom Tab.** `@capacitor/browser`의 `Browser.open({ url: <origin>/auth/app-start?provider=google&challenge=…&callbackUrl=/dashboard })`로 엽니다.
3. **Custom Tab `/auth/app-start`: 핸드오프 쿠키와 로그인 시작.**
   - 서버가 `{challenge, callbackUrl}`을 `NEXTAUTH_SECRET`로 서명해 핸드오프 쿠키에 담습니다. 쿠키는 10분 · httpOnly · Secure · SameSite=Lax입니다.
   - NextAuth 로그인을 `callbackUrl=/auth/app-complete`로 시작합니다. v4는 CSRF 토큰과 POST가 필요하므로, 페이지가 `signIn()`을 부르거나 자동 제출 폼을 씁니다.
4. **공급자 OAuth.** 기존 `/api/auth/callback/<provider>`가 Custom Tab의 Chrome 쿠키 저장소에서 처리합니다. 공급자 콘솔의 리디렉션 URI는 바꾸지 않습니다.
5. **Custom Tab `/auth/app-complete`: 일회용 코드 발급.**
   - Chrome 쪽 세션(`getServerSession`)과 핸드오프 쿠키를 읽어 일회용 코드를 만듭니다. 코드는 무작위 32바이트입니다.
   - SQLite에는 코드의 SHA-256 해시, `challenge`, 세션 클레임(`userId`, `name`, `email`, `picture`), `expiresAt = now + 60s`, `usedAt`만 저장합니다.
   - 핸드오프 쿠키와 Chrome 쪽 세션 쿠키를 지웁니다. 브라우저에 로그인이 남지 않게 하기 위해서입니다.
   - App Link `https://<APP_LINK_HOST>/auth/app-return?code=<code>`로 돌려보냅니다. Chrome은 같은 호스트로의 이동을 앱에 넘기지 않을 수 있습니다. 그래서 `intent://<host>/auth/app-return?code=…#Intent;scheme=https;package=com.worshiptogether.app;end`로 패키지를 지정하고, 실패에 대비해 "앱으로 돌아가기" 버튼(사용자 제스처)도 둡니다.
6. **앱: `appUrlOpen`으로 교환 요청.** `/auth/app-return`이 오면 `NativeBridge`가 WebView에서 같은 원점으로 `POST /api/auth/app-exchange { code, verifier }`를 보냅니다.
7. **서버: 검증 후 WebView에 세션 쿠키 설정.**
   - 검증 항목: Origin 확인, 코드 해시 조회, 만료, `base64url(SHA-256(verifier)) === challenge`
   - 사용 표시는 `UPDATE … SET used_at = now WHERE used_at IS NULL`로 원자적으로 처리해 한 번만 쓰이게 합니다.
   - 검증을 통과하면 `next-auth/jwt`의 `encode()`로 기존 `jwt` 콜백과 같은 모양의 토큰을 만듭니다.
   - NextAuth와 같은 이름과 속성의 세션 쿠키(`__Secure-next-auth.session-token`, httpOnly, Secure, SameSite=Lax, Path=/, 30일)를 응답에 설정합니다.
   - 앱은 `Browser.close()`, `router.replace(callbackUrl)`, `router.refresh()` 순으로 마무리합니다. `singleTask`라서 앱이 앞으로 오면 위에 쌓인 Custom Tab도 정리됩니다.

**보안 성질:**
- 코드가 다른 앱이나 로그로 새도 `verifier` 없이는 쓸 수 없습니다. `verifier`는 WebView 밖으로 나가지 않습니다.
- 코드는 60초 동안만 유효하고 한 번만 쓰입니다. 서버에는 해시만 남습니다.
- 교환 API에는 시도 횟수 제한을 둡니다.

### 바뀔 파일

| 파일 | 변경 |
| --- | --- |
| `package.json` | `@capacitor/browser@^8` 추가 |
| `lib/nativeAuth.ts` (+ `tests/nativeAuth.test.ts`) | verifier · challenge 생성, base64url, 코드 검증 순수 함수 |
| `components/auth/LoginButtons.tsx` | 네이티브면 `signIn()` 대신 Custom Tab 흐름 |
| `app/auth/app-start/page.tsx` | 핸드오프 쿠키를 설정하고 NextAuth 로그인 시작 |
| `app/auth/app-complete/page.tsx` | 일회용 코드 발급 → `intent:` / App Link 복귀 |
| `app/api/auth/app-exchange/route.ts` | 코드 · verifier 검증 → 세션 쿠키 설정 |
| `lib/server/appLoginCodes.ts` (+ SQLite 테이블) | 코드 해시 · challenge · 클레임 · 만료 · 사용 시각 저장 |
| `lib/authConfig.ts` | 토큰 클레임 생성을 공용 함수로 분리(교환 API와 공유) |
| `components/app/NativeBridge.tsx`, `lib/nativeNav.ts` | `/auth/app-return` 처리. 일반 앱 링크보다 먼저 확인합니다. |
| `android/app/src/main/AndroidManifest.xml` | `<data android:path="/auth/app-return" />` 추가 |
| `docs/auth-and-invitations.md` | 앱 로그인 절차와 점검 항목 |
