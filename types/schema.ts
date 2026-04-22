export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    username: string | null
                    avatar_url: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    username?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    username?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                }
            }
            teams: {
                Row: {
                    id: string
                    name: string
                    owner_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    owner_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    owner_id?: string
                    created_at?: string
                }
            }
            team_members: {
                Row: {
                    team_id: string
                    user_id: string
                    role: string | null
                    joined_at: string | null
                }
                Insert: {
                    team_id: string
                    user_id: string
                    role?: string | null
                    joined_at?: string | null
                }
                Update: {
                    team_id?: string
                    user_id?: string
                    role?: string | null
                    joined_at?: string | null
                }
            }
            songs: {
                Row: {
                    id: string
                    team_id: string | null
                    title: string
                    artist: string | null
                    original_key: string | null
                    bpm: number | null
                    music_xml_url: string | null
                    data_xml: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    team_id?: string | null
                    title: string
                    artist?: string | null
                    original_key?: string | null
                    bpm?: number | null
                    music_xml_url?: string | null
                    data_xml?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    team_id?: string | null
                    title?: string
                    artist?: string | null
                    original_key?: string | null
                    bpm?: number | null
                    music_xml_url?: string | null
                    data_xml?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            setlists: {
                Row: {
                    id: string
                    team_id: string | null
                    title: string
                    worship_date: string
                    theme: string | null
                    song_order: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    team_id?: string | null
                    title: string
                    worship_date: string
                    theme?: string | null
                    song_order?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    team_id?: string | null
                    title?: string
                    worship_date?: string
                    theme?: string | null
                    song_order?: Json | null
                    created_at?: string
                    updated_at?: string
                }
            }
            service_preparation: {
                Row: {
                    id: string
                    team_id: string
                    setlist_id: string
                    brief: string | null
                    scripture_reference: string | null
                    prayer_focus: string | null
                    worship_flow: string | null
                    announcement: string | null
                    leader_notes: string | null
                    call_time_notes: string | null
                    rehearsal_time: string | null
                    call_time: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    team_id: string
                    setlist_id: string
                    brief?: string | null
                    scripture_reference?: string | null
                    prayer_focus?: string | null
                    worship_flow?: string | null
                    announcement?: string | null
                    leader_notes?: string | null
                    call_time_notes?: string | null
                    rehearsal_time?: string | null
                    call_time?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    team_id?: string
                    setlist_id?: string
                    brief?: string | null
                    scripture_reference?: string | null
                    prayer_focus?: string | null
                    worship_flow?: string | null
                    announcement?: string | null
                    leader_notes?: string | null
                    call_time_notes?: string | null
                    rehearsal_time?: string | null
                    call_time?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            service_assignments: {
                Row: {
                    id: string
                    service_preparation_id: string
                    profile_id: string
                    role: string
                    instrument: string | null
                    needs_help_note: string | null
                    is_confirmed: boolean | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    service_preparation_id: string
                    profile_id: string
                    role: string
                    instrument?: string | null
                    needs_help_note?: string | null
                    is_confirmed?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    service_preparation_id?: string
                    profile_id?: string
                    role?: string
                    instrument?: string | null
                    needs_help_note?: string | null
                    is_confirmed?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            service_readiness_checks: {
                Row: {
                    id: string
                    service_assignment_id: string
                    check_key: string
                    label: string
                    is_complete: boolean | null
                    note: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    service_assignment_id: string
                    check_key: string
                    label: string
                    is_complete?: boolean | null
                    note?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    service_assignment_id?: string
                    check_key?: string
                    label?: string
                    is_complete?: boolean | null
                    note?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            song_preparation_notes: {
                Row: {
                    id: string
                    service_preparation_id: string
                    song_id: string
                    note: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    service_preparation_id: string
                    song_id: string
                    note?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    service_preparation_id?: string
                    song_id?: string
                    note?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
            }
            sessions: {
                Row: {
                    id: string
                    team_id: string | null
                    setlist_id: string | null
                    leader_id: string | null
                    is_active: boolean
                    current_state: Json | null
                    started_at: string
                    ended_at: string | null
                }
                Insert: {
                    id?: string
                    team_id?: string | null
                    setlist_id?: string | null
                    leader_id?: string | null
                    is_active?: boolean
                    current_state?: Json | null
                    started_at?: string
                    ended_at?: string | null
                }
                Update: {
                    id?: string
                    team_id?: string | null
                    setlist_id?: string | null
                    leader_id?: string | null
                    is_active?: boolean
                    current_state?: Json | null
                    started_at?: string
                    ended_at?: string | null
                }
            }
            session_feedback: {
                Row: {
                    id: string
                    session_id: string
                    team_id: string
                    client_id: string | null
                    role: string
                    message: string
                    song_id: string | null
                    song_title: string | null
                    page: number
                    section: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    team_id: string
                    client_id?: string | null
                    role: string
                    message: string
                    song_id?: string | null
                    song_title?: string | null
                    page?: number
                    section?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    team_id?: string
                    client_id?: string | null
                    role?: string
                    message?: string
                    song_id?: string | null
                    song_title?: string | null
                    page?: number
                    section?: string | null
                    created_at?: string
                }
            }
        }
    }
}
