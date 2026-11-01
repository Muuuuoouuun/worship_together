-- ─────────────────────────────────────────────────────────────────────────────
-- Worship Together — Supabase schema (LEGACY / OPTIONAL)
--
-- 이 파일은 운영자용 문서입니다. 앱의 온라인 팀(팀 · 명단 · 일정 · 콘티 · 곡 보관함 · 예배 세션)은
-- Supabase 가 아니라 서버의 SQLite 파일(TEAM_DATABASE_PATH, lib/server/*)에 있습니다.
-- Supabase 는 NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣었을 때만 쓰는 예전 경로
-- (actions/libraryActions.ts 의 곡 · 콘티 저장, /session/[id] 의 세션 읽기)이며, 비워 두는 것이 기본입니다.
--
-- 보안(RLS · 권한 · 정책)은 supabase/migrations/20261101_rls.sql 에 따로 있습니다 — 이 파일 다음에 실행하세요.
-- 그 파일은 모든 팀 데이터 테이블에 RLS 를 켜고 anon 에게는 아무 정책도 주지 않습니다(= 읽기 · 쓰기 모두 거부).
-- 적용하면 anon 키를 쓰는 예전 경로는 동작하지 않으므로, 다시 쓰려면 서버 전용 service_role 클라이언트가 필요합니다
-- (아직 없음 — 자세한 내용은 그 파일 머리말).
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles: Public user data
create table profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  updated_at timestamp with time zone,

  constraint username_length check (char_length(username) >= 3)
);

-- Teams: Groups of users
create table teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references profiles(id) not null,
  created_at timestamp with time zone default now()
);

-- Team Members
create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamp with time zone default now(),
  primary key (team_id, user_id)
);

-- Sheets: Music pieces
-- Songs: Musical content (formerly Sheets)
create table songs (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade,
  title text not null,
  artist text,
  original_key text,
  bpm integer,
  music_xml_url text, -- Supabase Storage URL
  data_xml text, -- Raw MusicXML content for VexFlow
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Setlists: Planned worship services
create table setlists (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade,
  title text not null, -- e.g. "Sunday Service"
  worship_date timestamp with time zone not null,
  theme text,
  song_order jsonb, -- Array of song_ids ["id1", "id2"]
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Service preparation: Brief, notes, and team readiness for a setlist
create table service_preparation (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade not null,
  setlist_id uuid references setlists(id) on delete cascade not null unique,
  brief text,
  scripture_reference text,
  prayer_focus text,
  worship_flow text,
  announcement text,
  leader_notes text,
  call_time_notes text,
  rehearsal_time text,
  call_time text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Service assignments: Who is serving on the preparation plan
create table service_assignments (
  id uuid default uuid_generate_v4() primary key,
  service_preparation_id uuid references service_preparation(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  role text not null,
  instrument text,
  needs_help_note text,
  is_confirmed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint service_assignments_unique_member unique (service_preparation_id, profile_id)
);

-- Service readiness checks: Checklist items for each assignment
create table service_readiness_checks (
  id uuid default uuid_generate_v4() primary key,
  service_assignment_id uuid references service_assignments(id) on delete cascade not null,
  check_key text not null,
  label text not null,
  is_complete boolean default false,
  note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint service_readiness_checks_unique_item unique (service_assignment_id, check_key)
);

-- Song preparation notes: Service-specific notes for a song in a service
create table song_preparation_notes (
  id uuid default uuid_generate_v4() primary key,
  service_preparation_id uuid references service_preparation(id) on delete cascade not null,
  song_id uuid references songs(id) on delete cascade not null,
  note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint song_preparation_notes_unique_song unique (service_preparation_id, song_id)
);

-- Sessions: Live performance capability
-- Sessions: Live performance capability
create table sessions (
  id uuid default uuid_generate_v4() primary key,
  team_id uuid references teams(id) on delete cascade,
  setlist_id uuid references setlists(id),
  leader_id uuid references profiles(id),
  is_active boolean default true,
  current_state jsonb, -- { "songId": "...", "section": "verse", "page": 1 }
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone
);

-- Session feedback: durable live cues and team messages for a session
create table session_feedback (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references sessions(id) on delete cascade not null,
  team_id uuid references teams(id) on delete cascade not null,
  client_id text,
  role text not null check (role in ('leader', 'instrument', 'broadcast')),
  message text not null check (char_length(trim(message)) between 1 and 220),
  song_id uuid references songs(id) on delete set null,
  song_title text,
  page integer not null default 1 check (page >= 1),
  section text,
  created_at timestamp with time zone default now()
);

create index session_feedback_session_created_idx
  on session_feedback (session_id, created_at desc);

create index session_feedback_team_created_idx
  on session_feedback (team_id, created_at desc);

-- Session State: Real-time synchronization state (Ephemeral-ish)
-- Can be stored in database for persistence or relied on Realtime channel presence
create table session_state (
  session_id uuid references sessions(id) on delete cascade primary key,
  current_section_index integer default 0,
  is_playing boolean default false,
  updated_at timestamp with time zone default now()
);

-- Annotations: Drawing layers
create table annotations (
  id uuid default uuid_generate_v4() primary key,
  song_id uuid references songs(id) on delete cascade,
  user_id uuid references profiles(id),
  session_id uuid references sessions(id), -- Optional: if tied to a specific session
  type text check (type in ('drawing', 'text', 'highlight')),
  data jsonb not null, -- Stores coordinates, color, stroke width
  is_private boolean default false, -- If true, only visible to creator
  created_at timestamp with time zone default now()
);

-- Storage Buckets Configuration (Pseudo-code, to be set up in dashboard)
-- insert into storage.buckets (id, name, public) values ('sheets', 'sheets', true);

-- RLS · 권한 · 정책은 supabase/migrations/20261101_rls.sql 에 있습니다.
-- 이 파일(테이블 만들기)을 실행한 뒤 그 파일을 실행하세요. 그 파일은 여러 번 실행해도 되고, 이미 테이블이 있는
-- 운영 프로젝트에는 이 파일 대신 그 파일만 실행합니다(이 파일의 create table 은 이미 있으면 오류로 멈춥니다).
