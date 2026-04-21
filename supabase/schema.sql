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

-- RLS Policies (Examples)
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);
