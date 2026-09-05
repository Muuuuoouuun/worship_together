# 로그인과 팀 초대 설정

Google·네이버 OAuth 로그인, 서버 팀 명단·역할, 7일 초대 링크와 카카오 공유를 연결했습니다. 실제 서비스 로그인과 카카오 발송은 아래 앱 키와 공개 주소를 설정한 뒤 확인해야 합니다. 현재 자동 테스트는 제공자 통신을 모의 응답으로 대체하며, 팀 참여는 별도 브라우저의 서명된 테스트 세션으로 검증했습니다.

## 환경변수

`.env.example`을 참고하여 `.env.local` 또는 배포 서버 환경에 설정합니다. 기존 환경 파일의 값을 보존하세요.

| 항목 | 설정 |
| --- | --- |
| `NEXTAUTH_URL` | 개발 `http://localhost:4000`, 운영은 실제 공개 HTTPS 원점. 경로·쿼리 없이 입력 |
| `NEXTAUTH_SECRET` | 충분히 긴 무작위 서버 비밀키. 모든 재시작에서 같은 값 유지 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google 웹 애플리케이션 OAuth 클라이언트 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 로그인 애플리케이션 |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | Kakao JavaScript 키. Admin 키나 REST API 키를 넣지 않음 |
| `TEAM_DATABASE_PATH` | 선택 사항. 영속 볼륨의 SQLite 절대 경로. 기본 `.data/teams.sqlite` |

키는 저장소에 커밋하지 않습니다. 비밀키 생성 예시:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Node.js 22.13 이상에서 실행합니다. 환경변수 변경 후 서버를 재시작하고, `NEXT_PUBLIC_` 값 변경 후에는 다시 빌드합니다. 로그인 설정이 불완전하면 해당 제공자 버튼은 비활성 상태와 안내 문구를 표시합니다.

## Google

Google Cloud에서 OAuth 동의 화면과 **웹 애플리케이션** 클라이언트를 설정하고 사용할 계정 범위를 준비합니다. 승인된 리디렉션 URI에 정확히 다음 주소를 등록합니다.

- 개발: `http://localhost:4000/api/auth/callback/google`
- 운영: `https://실제-서비스-도메인/api/auth/callback/google`

클라이언트 ID·비밀키를 환경변수에 설정합니다. 제공자 콘솔의 테스트·게시 상태에 따라 허용된 계정으로 검증합니다. [NextAuth Google 제공자 문서](https://next-auth.js.org/providers/google)

## 네이버

네이버 개발자센터 애플리케이션에 네이버 로그인을 추가하고 서비스 URL 및 콜백 URL을 등록합니다.

- 개발: `http://localhost:4000/api/auth/callback/naver`
- 운영: `https://실제-서비스-도메인/api/auth/callback/naver`

발급된 Client ID와 Client Secret을 환경변수에 설정합니다. 프로필 이름을 받을 수 있도록 동의 항목을 확인합니다. 로그인 후 식별자는 제공자 계정 ID에서 생성하며, Google과 네이버의 이메일이 같아도 계정을 자동 병합하지 않습니다. [NextAuth 네이버 제공자 문서](https://next-auth.js.org/providers/naver)

## 카카오톡 초대

Kakao Developers 애플리케이션에서 JavaScript 키를 발급받고, 웹 플랫폼·JavaScript SDK 도메인과 메시지 링크에 사용할 웹 도메인을 실제 서비스 주소로 등록합니다. SDK 2.8.3의 `Kakao.Share.sendDefault` 텍스트 템플릿을 사용합니다.

앱 키 설정·빌드·재시작 후 팀 관리자가 **초대 링크 만들기 → 카카오톡 초대**를 누릅니다. 공유창에서 받는 사람을 선택하고 전송하는 절차는 사용자가 진행합니다. 앱은 공유창을 연 것을 전달 완료나 읽음으로 표시하지 않습니다. 키가 없거나 SDK 로딩에 실패하면 링크 복사를 사용할 수 있습니다.

`localhost` 링크는 다른 기기에서 열 수 없으므로 카카오 버튼을 비활성화합니다. 실제 초대에는 공개 HTTPS 주소를 사용하세요. [카카오톡 공유 JavaScript 가이드](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link) · [SDK 다운로드](https://developers.kakao.com/docs/ko/javascript/download)

## 초대·권한 동작

팀을 만든 관리자만 초대를 발급·취소하거나 담당 역할을 변경할 수 있습니다. 초대 토큰은 무작위 256비트이며 서버에는 해시만 저장합니다. 발급 후 7일이 지나면 만료되고 새 링크 발급은 이전 링크를 취소합니다. 이미 참여한 팀원은 초대를 취소해도 팀에 남습니다.

초대 페이지는 팀 이름과 만료일을 보여줍니다. 로그인 후 **이 예배팀에 참여하기**를 눌러 참여를 확정합니다. 로그인 취소·실패 후에도 복귀할 초대 경로를 유지하고 외부 사이트로의 로그인 복귀는 차단합니다. 참여는 일반 팀원 권한이며 ‘인도자’라는 담당 역할만 배정해도 관리자가 되지는 않습니다.

## 배포와 저장 범위

현재 팀 저장소는 `better-sqlite3`를 사용하는 **영속 디스크가 있는 단일 Node.js 서버**입니다. 데이터베이스 디렉터리를 재배포 후에도 유지하고 SQLite에 맞는 백업 방식으로 보관합니다. 서버리스 임시 디스크나 서로 다른 디스크의 다중 인스턴스에 그대로 배포하는 구성은 지원하지 않습니다.

소셜 로그인과 SQLite 팀 데이터는 기존 Supabase 연결과 독립적입니다. 팀 명단·역할은 같은 서버에 접속하는 여러 기기에 공유되지만, 현재 곡·콘티·송폼·악보·필기는 기기 저장 또는 파일 교환 범위입니다. 기존 체험 팀은 팀 화면 하단의 접힌 영역에 보존되며 온라인 팀으로 자동 이전되지 않습니다.

## 활성화 후 확인

1. 실제 Google·네이버 계정으로 각각 로그인·취소·로그아웃을 확인합니다.
2. 관리자 기기에서 팀을 만들고 링크를 생성합니다.
3. 다른 모바일·태블릿에서 링크를 열어 로그인 후 참여합니다.
4. 관리자 명단 새로고침과 역할 변경을 확인합니다.
5. 링크 교체·취소 후 이전 링크로 신규 참여가 거부되는지 확인합니다.
6. 카카오 공유창에서 사용자가 전송하고 받은 링크로 참여하는 흐름을 확인합니다.

코드 검증은 `npm test`, `npm run lint`, `npm run build`로 실행합니다. 이번 구현 검증에서 실제 외부 메시지를 발송하지 않았습니다.
