# 브라우저 E2E

Playwright(Chromium)로 실제 `next dev` 서버를 조작하는 점검 스크립트입니다. 모두 일반 Node(CommonJS) 스크립트이며 `npm test`(`tests/*.test.ts`)와 린트 대상에서 제외됩니다.

| 명령 | 파일 | 하는 일 |
| --- | --- | --- |
| `npm run test:e2e` | `login-flow.cjs` | 로그인 → 팀 생성 → 초대 수락 → 역할 지정 → 일정·배정 → 알림 배지/읽음 → 참석·불참 응답(긴급 알림) → 무대 실시간 큐 → 권한 침투 점검, 10단계 |
| `npm run test:e2e:mobile` | `mobile-smoke.cjs` | 핵심 6개 경로를 Pixel 7·iPhone 14 Pro Max 로 열어 가로 넘침·콘솔/페이지 오류 확인(실패 처리), 40px 미만 터치 대상은 개수만 보고 |

실패한 단계가 하나라도 있으면 종료 코드가 0이 아니며, 끝에 단계 표를 출력합니다. 로그인 플로우는 15초 주기 알림 폴링을 기다리므로 약 2분 걸립니다.

## 준비

1. `npm ci` 후 브라우저를 한 번 설치합니다: `npx playwright install chromium`
2. **`next dev` 서버**를 띄웁니다(기본 `http://localhost:4000`). `next start` 는 http localhost 에서 인증 쿠키가 꺼져 있어 로그인 플로우가 동작하지 않습니다.
3. 서버는 **버려도 되는 DB**로 띄우세요: `TEAM_DATABASE_PATH=/tmp/e2e-teams.sqlite npm run dev`. 로그인 플로우는 시작할 때 테스트 사용자가 가진 팀을 모두 삭제하고, 중간에 팀·일정을 만듭니다.
4. `NEXTAUTH_SECRET` 을 환경변수로 주거나 `.env.local` 에 둡니다(서버와 같은 값이어야 함).

## 환경변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:4000` | 대상 서버. localhost 가 아니면 `E2E_ALLOW_REMOTE=1` 없이는 로그인 플로우가 거부됩니다 |
| `E2E_OUT` | `<OS 임시폴더>/worship-together-e2e` | 스크린샷(`shots/`, `mobile/`)과 `result.json`·`mobile-result.json` 저장 위치 |
| `NEXTAUTH_SECRET` | `.env.local` 값 | 테스트 세션 서명용 |

## 테스트 세션이 동작하는 방식

OAuth 화면을 거치지 않고 `lib/session.cjs` 의 `mintSessionCookie({ provider, accountId, name, secret })` 가 NextAuth v4 JWT 를 `NEXTAUTH_SECRET` 으로 직접 서명해 `next-auth.session-token` 쿠키로 심습니다. 사용자 id 는 `lib/authConfig.ts` 의 `providerUserId` 와 같은 `sha256("provider:accountId")` 규칙이라 서버는 정상 로그인으로 취급합니다. 그 규칙을 바꾸면 `e2e/lib/session.cjs` 도 같이 고쳐야 합니다.

**개발 전용입니다.** secret 을 아는 사람은 누구나 임의 사용자의 세션을 만들 수 있으므로, 운영 서버나 운영 DB 에는 절대 실행하지 마세요. 운영 secret 을 로컬 `.env.local` 에 두지도 마세요.

## 결과 폴더를 저장소 밖에 두는 이유

`result.json` 에는 브라우저 콘솔 오류 원문이 들어갑니다. 저장소 안(`e2e/.out` 등)에 두면 `next dev` 의 Tailwind 가 그 텍스트를 클래스 후보로 긁어 가고, 오류 문구가 다시 후보가 되는 되먹임으로 `app/globals.css` 파싱이 깨져 개발 서버가 전부 500 을 돌려줄 수 있습니다(Tailwind 후보 캐시는 서버를 재시작해야 비워짐). 그래서 기본 출력은 OS 임시 폴더이며, `E2E_OUT` 을 저장소 안으로 지정하지 마세요. `e2e/.gitignore`(`.out/`)는 혹시 그렇게 쓸 때 커밋만 막는 안전장치입니다.
