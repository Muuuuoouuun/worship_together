-- ─────────────────────────────────────────────────────────────────────────────
-- Worship Together — 예전 Supabase 경로의 RLS · 권한 (LEGACY / OPTIONAL)
--
-- supabase/schema.sql 로 테이블을 만든 뒤 이 파일을 실행합니다. 이미 운영 중인 프로젝트에도 그대로 실행할 수 있고,
-- 여러 번 실행해도 같은 결과입니다(멱등):
--   · alter table … enable row level security 는 이미 켜져 있어도 오류가 없습니다.
--   · 함수는 create or replace, 정책은 drop policy if exists 뒤에 다시 만듭니다.
--   · revoke 는 이미 거둔 권한이어도 오류가 없습니다.
-- (schema.sql 은 create table 이 멱등이 아니라 이미 테이블이 있는 프로젝트에서는 첫 줄에서 멈추므로, RLS 를 따로 뺐습니다.)
--
-- 보안 기본값: 팀 데이터 테이블 12개에 RLS 를 켜고 anon 에게는 정책도 테이블 권한도 주지 않습니다(= 읽기 · 쓰기 모두 거부).
-- 이 앱은 Supabase Auth 가 아니라 NextAuth 로 로그인하므로, 브라우저의 anon 키로는 auth.uid() 가 없습니다.
-- 읽기 정책은 Supabase Auth 로 로그인한 그 팀의 팀원(team_members)에게만 열려 있고, 쓰기 정책은 일부러 만들지 않습니다.
--
-- ⚠ 적용한 뒤 앱에서 달라지는 점
--   앱의 예전 Supabase 경로(lib/supabase.ts 의 anon 키 클라이언트 — actions/libraryActions.ts 의 곡 · 콘티 저장,
--   lib/data.ts 의 getSongsByTeam · getSetlistsByTeam · /session/[id] 읽기)는 이 파일을 적용하면 더는 동작하지 않습니다
--   (읽기는 빈 목록, 쓰기는 권한 오류). 다시 쓰려면 서버에서만 쓰는 service_role 키 클라이언트(RLS 를 건너뜀)를 따로
--   만들어 서버 액션이 권한 확인(lib/server/legacyAccess.ts) 뒤에 그 클라이언트로 쓰게 해야 합니다 — 이 저장소에는 아직 없습니다.
--   service_role 키는 NEXT_PUBLIC_ 이름으로 두지 말고, anon 쓰기 정책도 만들지 마세요.
--   그때까지 곡 보관함 화면은 Supabase 가 연결돼 있으면 바꾸기 버튼 대신 권한 안내를 보여 줍니다
--   (app/(app)/dashboard/songs/library/page.tsx, lib/legacyAccess.ts canMutateLibrary).
--   온라인 팀(팀 · 명단 · 일정 · 콘티 · 곡 보관함 · 예배 세션)은 Supabase 가 아니라 서버 SQLite 에 있으므로 영향이 없습니다.
-- ─────────────────────────────────────────────────────────────────────────────

-- 프로필: 누구나 읽고, 자기 프로필만 만들고 고칩니다 (Supabase Auth 기준)
alter table public.profiles enable row level security;
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 팀 데이터: RLS 를 켜면 정책이 없는 동작은 모두 거부됩니다(anon · authenticated 모두).
-- service_role(서버 전용 키)은 RLS 를 건너뛰므로, 쓰기는 서버에서 권한을 확인한 뒤 service_role 로만 하세요.
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.service_preparation enable row level security;
alter table public.service_assignments enable row level security;
alter table public.service_readiness_checks enable row level security;
alter table public.song_preparation_notes enable row level security;
alter table public.sessions enable row level security;
alter table public.session_feedback enable row level security;
alter table public.session_state enable row level security;
alter table public.annotations enable row level security;

-- anon 키로는 팀 데이터에 아예 닿지 않게 테이블 권한도 거둡니다 (RLS 와 이중 잠금).
revoke all on public.teams, public.team_members, public.songs, public.setlists, public.service_preparation,
  public.service_assignments, public.service_readiness_checks, public.song_preparation_notes, public.sessions,
  public.session_feedback, public.session_state, public.annotations
  from anon;

-- 이 사람(auth.uid())이 그 팀의 팀원인지. team_members 정책이 자기 자신을 다시 읽으며 무한히 도는 것을 막으려고
-- security definer 함수로 확인합니다.
create or replace function public.is_team_member(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = target_team and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_team_member(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;

-- 읽기: 로그인한(Supabase Auth) 그 팀의 팀원만. 쓰기 정책은 일부러 만들지 않습니다(= 거부).
drop policy if exists "Members can view their teams." on public.teams;
create policy "Members can view their teams." on public.teams for select to authenticated using (public.is_team_member(id));
drop policy if exists "Members can view their team roster." on public.team_members;
create policy "Members can view their team roster." on public.team_members for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view team songs." on public.songs;
create policy "Members can view team songs." on public.songs for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view team setlists." on public.setlists;
create policy "Members can view team setlists." on public.setlists for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view service preparation." on public.service_preparation;
create policy "Members can view service preparation." on public.service_preparation for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view service assignments." on public.service_assignments;
create policy "Members can view service assignments." on public.service_assignments for select to authenticated using (
  exists (select 1 from public.service_preparation p where p.id = service_preparation_id and public.is_team_member(p.team_id))
);
drop policy if exists "Members can view readiness checks." on public.service_readiness_checks;
create policy "Members can view readiness checks." on public.service_readiness_checks for select to authenticated using (
  exists (
    select 1 from public.service_assignments a
    join public.service_preparation p on p.id = a.service_preparation_id
    where a.id = service_assignment_id and public.is_team_member(p.team_id)
  )
);
drop policy if exists "Members can view song preparation notes." on public.song_preparation_notes;
create policy "Members can view song preparation notes." on public.song_preparation_notes for select to authenticated using (
  exists (select 1 from public.service_preparation p where p.id = service_preparation_id and public.is_team_member(p.team_id))
);
drop policy if exists "Members can view team sessions." on public.sessions;
create policy "Members can view team sessions." on public.sessions for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view session feedback." on public.session_feedback;
create policy "Members can view session feedback." on public.session_feedback for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "Members can view session state." on public.session_state;
create policy "Members can view session state." on public.session_state for select to authenticated using (
  exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id))
);
drop policy if exists "Members view shared annotations; owners view private ones." on public.annotations;
create policy "Members view shared annotations; owners view private ones." on public.annotations for select to authenticated using (
  user_id = auth.uid()
  or (not is_private and exists (select 1 from public.songs s where s.id = song_id and public.is_team_member(s.team_id)))
);
