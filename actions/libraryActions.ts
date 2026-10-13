'use server';

import { DEMO_TEAM_ID } from '@/lib/constants';
import { normalizeSetlistSongOrder } from '@/lib/libraryPrototypeStorage';
import { getSupabaseClient, supabase as configuredSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createSong(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const title = getString(formData, 'title');
    const artist = getNullableString(formData, 'artist');
    const originalKey = getNullableString(formData, 'originalKey');
    const musicXmlUrl = getNullableString(formData, 'musicXmlUrl');
    const dataXml = getNullableString(formData, 'dataXml');
    const bpmValue = getNullableString(formData, 'bpm');
    const parsedBpm = bpmValue ? Number(bpmValue) : null;
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;

    if (!title) {
        redirect('/dashboard/songs/library?error=missing-song-title');
    }

    if (bpmValue && (parsedBpm === null || !Number.isInteger(parsedBpm) || parsedBpm < 20 || parsedBpm > 300)) {
        redirect('/dashboard/songs/library?error=invalid-bpm');
    }

    const { error } = await supabase
        .from('songs')
        .insert({
            team_id: teamId,
            title,
            artist,
            original_key: originalKey,
            bpm: parsedBpm,
            music_xml_url: musicXmlUrl,
            data_xml: dataXml,
        });

    if (error) {
        console.error('Failed to create song:', error);
        redirect('/dashboard/songs/library?error=create-song');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?created=song');
}

export async function createSetlist(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;
    const title = getString(formData, 'title');
    const theme = getNullableString(formData, 'theme');
    const worshipDateInput = getString(formData, 'worshipDate');
    const songIds = formData
        .getAll('songIds')
        .map((value) => String(value))
        .filter(Boolean);

    if (!title) {
        redirect('/dashboard/songs/library?error=missing-setlist-title');
    }

    if (!worshipDateInput) {
        redirect('/dashboard/songs/library?error=missing-worship-date');
    }

    const worshipDate = new Date(worshipDateInput);

    if (Number.isNaN(worshipDate.getTime())) {
        redirect('/dashboard/songs/library?error=invalid-worship-date');
    }

    if (!songIds.length) redirect('/dashboard/songs/library?error=invalid-setlist-songs');
    const { data: teamSongs, error: songsError } = await supabase.from('songs').select('id').eq('team_id', teamId).in('id', [...new Set(songIds)]);
    if (songsError || !teamSongs || songIds.some(id => !teamSongs.some(song => song.id === id))) {
        redirect('/dashboard/songs/library?error=invalid-setlist-songs');
    }

    // 콘티 만들기 화면이 미리 정한 id 를 쓰면 곡별 세부 정보(Key·BPM·메모)와 같은 id 로 이어집니다.
    const requestedId = getString(formData, 'setlistId');
    const id = UUID_PATTERN.test(requestedId) ? requestedId : undefined;

    const { error } = await supabase
        .from('setlists')
        .insert({
            ...(id ? { id } : {}),
            team_id: teamId,
            title,
            theme,
            worship_date: worshipDate.toISOString(),
            song_order: songIds,
        });

    if (error) {
        console.error('Failed to create setlist:', error);
        redirect('/dashboard/songs/library?error=create-setlist');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?created=setlist');
}

export async function duplicateSetlistFromTemplate(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const setlistId = getString(formData, 'setlistId');
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;

    if (!setlistId) {
        redirect('/dashboard/songs/library?error=missing-setlist-id');
    }

    const { data: setlist, error: fetchError } = await supabase
        .from('setlists')
        .select('title, theme, worship_date, song_order')
        .eq('id', setlistId)
        .eq('team_id', teamId)
        .maybeSingle();

    if (fetchError || !setlist) {
        console.error('Failed to load setlist template:', fetchError);
        redirect('/dashboard/songs/library?error=duplicate-setlist');
    }

    const sourceDate = new Date(setlist.worship_date);
    const nextWorshipDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
    nextWorshipDate.setDate(nextWorshipDate.getDate() + 7);
    const songOrder = normalizeSetlistSongOrder(setlist.song_order);
    if (!songOrder.length) redirect('/dashboard/songs/library?error=invalid-setlist-songs');

    const { error } = await supabase
        .from('setlists')
        .insert({
            team_id: teamId,
            title: `${setlist.title} Copy`,
            theme: setlist.theme,
            worship_date: nextWorshipDate.toISOString(),
            song_order: songOrder,
        });

    if (error) {
        console.error('Failed to duplicate setlist template:', error);
        redirect('/dashboard/songs/library?error=duplicate-setlist');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?created=template');
}

export async function deleteSong(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const songId = getString(formData, 'songId');
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;

    if (!songId) redirect('/dashboard/songs/library?error=missing-song-id');

    const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to delete song:', error);
        redirect('/dashboard/songs/library?error=delete-song');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?deleted=song');
}

export async function deleteSetlist(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const setlistId = getString(formData, 'setlistId');
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;

    if (!setlistId) redirect('/dashboard/songs/library?error=missing-setlist-id');

    const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', setlistId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to delete setlist:', error);
        redirect('/dashboard/songs/library?error=delete-setlist');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?deleted=setlist');
}

export async function updateSongBpmPreset(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs/library?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const songId = getString(formData, 'songId');
    const teamId = getString(formData, 'teamId') || DEMO_TEAM_ID;
    const bpmValue = getNullableString(formData, 'bpm');
    const parsedBpm = bpmValue ? Number(bpmValue) : null;

    if (!songId) {
        redirect('/dashboard/songs/library?error=missing-song-id');
    }

    if (bpmValue && (parsedBpm === null || !Number.isInteger(parsedBpm) || parsedBpm < 20 || parsedBpm > 300)) {
        redirect('/dashboard/songs/library?error=invalid-bpm');
    }

    const { error } = await supabase
        .from('songs')
        .update({ bpm: parsedBpm })
        .eq('id', songId)
        .eq('team_id', teamId);

    if (error) {
        console.error('Failed to update song BPM preset:', error);
        redirect('/dashboard/songs/library?error=update-song-bpm');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs/library');
    redirect('/dashboard/songs/library?created=bpm');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getString(formData: FormData, key: string): string {
    return String(formData.get(key) ?? '').trim();
}

function getNullableString(formData: FormData, key: string): string | null {
    const value = getString(formData, key);
    return value.length > 0 ? value : null;
}
