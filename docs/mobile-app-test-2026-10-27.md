# 모바일 앱 버전 프로토타입 테스트 (2026-10-27)

1차 통합본(`claude/trusting-volta-obybpl`)을 **Capacitor Android 앱**과 **PWA(홈 화면 추가)** 두 형태로 검증한 결과입니다. 네 갈래로 나눠 진행했습니다: Android APK 빌드, 기기 에뮬레이션 UI 검사, PWA·오프라인 동작, 네이티브 코드 경로 인벤토리.

## 1. 요약

| 항목 | 결과 |
| --- | --- |
| Android debug APK 빌드 | **성공**. `app-debug.apk` 4.1MB, `com.worshiptogether.app` 1.0 (1), minSdk 24 / targetSdk 36 |
| 가로 스크롤 넘침 | 13개 화면 × 4기기에서 **0건** |
| 콘솔·페이지 오류·실패 요청 | **0건** |
| PWA 설치 조건 (manifest·아이콘·SW) | **충족** |
| 오프라인 폴백 | `/offline.html` 정상, 캐시 버전 정리 정상 |
| 발견 결함 | 높음 2 · 중간 4 · 낮음 5 (3장) |

이 컨테이너에는 KVM이 없어 Android 에뮬레이터는 띄우지 못했습니다. 기기 검증은 Playwright(Chromium) 에뮬레이션으로 대신했으며, iPhone·iPad는 뷰포트·UA·터치·safe-area만 흉내낸 것이고 WebKit 렌더링은 아닙니다.

## 2. 앱의 실제 구조

- **Capacitor 8 Android**: 네이티브 플러그인 사용 0건. `window.Capacitor.isNativePlatform()` 감지만 있고, 그 결과는 `PwaInstallPrompt`(설치 배너 숨김)에만 쓰입니다. 뒤로가기 키·상태바·딥링크 처리는 없습니다. 권한은 INTERNET·WAKE_LOCK·VIBRATE.
- **셸 방식**: `CAPACITOR_SERVER_URL`로 지정한 원격 Next.js 서버를 WebView가 불러옵니다. URL이 없으면 `mobile-www/index.html`의 영어 안내 카드만 보입니다. 이번 빌드는 `http://10.0.2.2:4000`(에뮬레이터 → 호스트 dev 서버)로 묶여 있고 `usesCleartextTraffic=true`가 병합됩니다.
- **PWA**: `start_url=/dashboard`, standalone, 아이콘 192·512(any) + 512(maskable, any와 같은 파일). 서비스 워커는 **프로덕션 또는 `NEXT_PUBLIC_ENABLE_SERVICE_WORKER=true`에서만** 등록. 전략은 내비게이션 network-first → 실패 시 `/offline.html`, 아이콘만 cache-first, 앱 셸 런타임 캐시 없음.
- **기기 저장소**: 곡·콘티·송폼·악보·필기·체험 팀이 localStorage/IndexedDB(`worship-together-sheets-v1`)에 있습니다. WebView 저장소는 폰 브라우저와 분리되므로 **앱과 브라우저를 오가면 자료가 따로 놉니다**.
- **로그인**: `signIn()`이 WebView 안에서 리다이렉트합니다. 콜백 복귀는 `NEXTAUTH_URL` 원점으로 고정되므로 셸이 부르는 서버 주소와 같아야 합니다. Google의 WebView 로그인 차단 정책은 실기기 검증이 필요합니다(미확인).

## 3. 결함 목록

| # | 심각도 | 증상 | 위치 | 근거 |
| --- | --- | --- | --- | --- |
| M1 | 높음 | **iOS 설치 배너가 ‘예배 시작 4박 카운트인’ 버튼을 덮어** iPhone에서 누를 수 없음. 끝까지 스크롤해도 배너(`fixed bottom-4 z-40`)가 버튼 위에 남고 safe-area 처리도 없음 | `components/ui/PwaInstallPrompt.tsx` | `session-team-iphone14pm.png` |
| M2 | 높음 | 같은 배너가 **하단 내비와 83px, 라이브 미니바와 11px 겹침**. 배너가 내비 뒤로 들어가 글자가 비침. Android도 `beforeinstallprompt` 수신 시 동일 | 〃 | `dashboard-iphone14pm.png`, `pwa-prompt-pixel7.png` |
| M3 | 중간 | **오프라인인데 상태 필이 “브라우저 탭”으로 유지**되고 큐를 눌러도 “이 브라우저 탭에 전송 · 수신 미확인”으로만 표시. `getRealtimeStatusMeta`가 BroadcastChannel이 있으면 offline 분기 전에 반환 | `components/session/WorshipTeamMode.tsx:1228-1250` | `04c-live-offline-after-cue.png` |
| M4 | 중간 | 시트 뷰어 하단 고정바(이전 · 악보 1p · 다음)에 **safe-area-inset-bottom 없음** → 홈 인디케이터와 겹침 | `components/session/SheetAnnotationWorkspace.tsx` | `session-pixel7.png` |
| M5 | 중간 | **iOS 입력 줌 유발(16px 미만)**: 시트 뷰어의 스탬프·키 select, 송폼 텍스트 input, 펄스 뷰의 수신 역할·큐 대상 select(14px) | 위 두 파일 | `team-pulse-pixel7.png` |
| M6 | 중간 | 방문했던 페이지도 **오프라인에서는 전부 offline.html**. 앱 셸 캐시가 없어 오프라인 사용 불가 (악보는 IndexedDB에 있어도 화면을 못 엶) | `public/sw.js` | `03-offline-dashboard-revisit.png` |
| M7 | 낮음 | 펄스 뷰 아이콘 버튼 작음: 이전 곡·다음 곡 24×24, 화면 꺼짐 방지·전체화면 35×48 | `WorshipTeamMode.tsx` | `team-pulse-pixel7.png` |
| M8 | 낮음 | 시트 뷰어 툴바: 악기 48×28, 찍기 48×32, 송폼 닫기 16×16. 펜 모드에서 40px 미만 57개 | `SheetAnnotationWorkspace.tsx` | `session-tool-pen-pixel7.png` |
| M9 | 낮음 | 콘티 탭·필터·링크 폭이 글자 폭뿐(“팀” 14×44, “모두 보기” 50×16), 일정 칩 높이 32px, 미니바 닫기 36×36 | `components/conti/*`, `components/planning/*` | `songs-alerts-pixel7.png`, `planning-pixel7.png` |
| M10 | 낮음 | maskable 아이콘이 any 아이콘과 같은 파일 → Android 마스크에서 로고 잘릴 수 있음. `apple-mobile-web-app-capable` 메타 없음 | `app/manifest.ts`, `app/layout.tsx` | manifest 검사 |
| M11 | 낮음 | `android/gradlew`가 실행 권한 없이 커밋되어 `./gradlew` 실패 | **이번에 수정** (`git update-index --chmod=+x`) | 빌드 로그 |

## 3-1. 수정 현황 (2026-10-28)

| # | 상태 | 수정 내용 | 재검증 |
| --- | --- | --- | --- |
| M1 | 수정 | 설치 배너를 `/session/*`에서 숨김 | iPhone 에뮬레이션에서 배너 0개, ‘예배 시작’ 클릭 가능 |
| M2 | 수정 | 배너를 하단 내비·라이브 미니바 위로 배치(safe-area 포함), 닫기 44px, z-30 | 배너 하단이 미니바보다 10px, 내비보다 75px 위 |
| M3 | 수정 | `lib/stageStatus.ts`로 분리해 offline/error를 먼저 판정, 오프라인 송신 문구 “오프라인 · 수신 미확인” | 오프라인 전환 시 필 “오프라인”, 테스트 4개 |
| M4 | 오탐 | 하단바 안쪽 div에 이미 `pb-safe`(34px) 적용. 바깥 고정 div만 0이었음 | CDP safe-area 34에서 안쪽 패딩 34px 확인 |
| M5 | 수정 | 수신 역할·큐 대상·스탬프·악보 키·송폼 텍스트 입력 16px | 측정 16px |
| M6 | 수정 | sw.js v3: 방문 화면 30개 + `/_next/static` 보관, 미방문은 offline.html | 프로덕션 빌드에서 무대 화면 오프라인 재열기 성공(‘예배 시작’ 렌더, 오류 0) |
| M7 | 수정 | 이전/다음 곡 44×44, 화면 꺼짐 방지·전체화면·잠금 44×48 | 측정값 |
| M8 | 수정 | 찍기 56×40, 악기 40px, 표준 송폼 적용 40px, 송폼 닫기 40×40, 체크박스 20px | 가로 넘침 없음 |
| M9 | 미수정 | 콘티 탭·필터·링크 폭, 일정 칩 높이, 미니바 닫기 — 디자인 토큰 수준 정리 필요 | — |
| M10 | 수정 | `icon-maskable-512.png`(안전 영역 80%), `apple-mobile-web-app-capable` 메타 | HTML에 두 메타 출력 확인 |
| M11 | 수정 | `gradlew` 실행 권한 | `./gradlew assembleDebug` 성공 |

## 4. 통과한 항목

- `viewport-fit=cover`, 하단 내비 `pb-[env(safe-area-inset-bottom)]`(iPhone 34px·WebView 24px), 헤더 상단 패딩(iPhone 59px·WebView 28px) 모두 반영.
- 모달·시트(더보기, 사역 불가일 등록, 비교 화면의 큐 보내기)가 뷰포트 안에 들어오고 배경 스크롤이 잠김.
- 달력 날짜 탭 → 새 일정 폼이 헤더 아래·내비 위로 스크롤됨.
- 펄스 뷰 ‘다음 섹션’(157×44)·‘한 번 더’(161×48) 동작, 카운트인 화면은 작은 타깃 0개.
- PWA: manifest 필드·아이콘 실제 크기 일치, SW 등록·precache(`/offline.html` + 아이콘 3개), 구버전 캐시 삭제, 오프라인 → 온라인 복구, 다크 `theme-color`, `apple-touch-icon` 180×180.
- standalone 모드에서 설치 안내가 숨겨지고, Capacitor 주입 시에도 숨겨짐.
- dev 서버 기준 첫 로드 DCL 106~217ms, 스크립트 전송 약 1MB(비압축 dev 번들, 상대 비교용).

## 5. 재현 방법

```bash
# APK (SDK는 cmdline-tools + platforms;android-36 + build-tools;35.0.0, JDK 21)
CAPACITOR_SERVER_URL=http://10.0.2.2:4000 npx cap sync android
cd android && ./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk

# PWA를 dev 서버에서 보려면
NEXT_PUBLIC_ENABLE_SERVICE_WORKER=true npm run dev
```

실기기에서 쓰려면 `CAPACITOR_SERVER_URL`을 공개 HTTPS 주소로 바꿔 다시 sync·빌드해야 합니다. 에뮬레이션 스크립트와 스크린샷(모바일 99장, PWA 17장)은 세션 스크래치에 있으며 저장소에는 넣지 않았습니다.

## 6. 권장 수정 순서

1. M1·M2: `PwaInstallPrompt`를 하단 내비 위(`bottom: calc(4rem + env(safe-area-inset-bottom))`)로 올리고 무대 화면(`/session/*`)에서는 표시하지 않기. 1파일.
2. M3: `getRealtimeStatusMeta`에서 `offline`을 먼저 판정하고, 오프라인 송신은 “전송 실패 · 오프라인”으로 표시. 1함수.
3. M4·M5: 시트 뷰어 하단바에 safe-area 패딩, 모바일 입력 글꼴 16px. 2파일.
4. M6: 앱 셸(`/dashboard`, `/session/[id]`의 정적 자원) stale-while-revalidate 캐시 추가. 오프라인 악보 열람이 목표라면 `/_next/static`도 포함.
5. M10: maskable 전용 아이콘(안전 영역 80%) 추가, `apple-mobile-web-app-capable` 수동 메타.
6. M7~M9: 탭 타깃 최소 44×44 규칙을 `tap-target` 유틸로 통일.
