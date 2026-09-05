'use server';

import { DEMO_TEAM_ID } from '@/lib/constants';
import { hasDuplicateSongIds, normalizeSetlistSongOrder } from '@/lib/libraryPrototypeStorage';
import { getSupabaseClient, supabase as configuredSupabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createSong(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const title = getString(formData, 'title');
    const artist = getNullableString(formData, 'artist');
    const originalKey = getNullableString(formData, 'originalKey');
    const musicXmlUrl = getNullableString(formData, 'musicXmlUrl');
    const dataXml = getNullableString(formData, 'dataXml');
    const bpmValue = getNullableString(formData, 'bpm');
    const parsedBpm = bpmValue ? Number(bpmValue) : null;

    if (!title) {
        redirect('/dashboard/songs?error=missing-song-title');
    }

    if (bpmValue && (parsedBpm === null || !Number.isInteger(parsedBpm) || parsedBpm < 20 || parsedBpm > 300)) {
        redirect('/dashboard/songs?error=invalid-bpm');
    }

    const { error } = await supabase
        .from('songs')
        .insert({
            team_id: DEMO_TEAM_ID,
            title,
            artist,
            original_key: originalKey,
            bpm: parsedBpm,
            music_xml_url: musicXmlUrl,
            data_xml: dataXml,
        });

    if (error) {
        console.error('Failed to create song:', error);
        redirect('/dashboard/songs?error=create-song');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');
    redirect('/dashboard/songs?created=song');
}

export async function createSetlist(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const title = getString(formData, 'title');
    const theme = getNullableString(formData, 'theme');
    const worshipDateInput = getString(formData, 'worshipDate');
    const songIds = formData
        .getAll('songIds')
        .map((value) => String(value))
        .filter(Boolean);

    if (!title) {
        redirect('/dashboard/songs?error=missing-setlist-title');
    }

    if (!worshipDateInput) {
        redirect('/dashboard/songs?error=missing-worship-date');
    }

    const worshipDate = new Date(worshipDateInput);

    if (Number.isNaN(worshipDate.getTime())) {
        redirect('/dashboard/songs?error=invalid-worship-date');
    }

    if (!songIds.length) redirect('/dashboard/songs?error=invalid-setlist-songs');
    if (hasDuplicateSongIds(songIds)) redirect('/dashboard/songs?error=duplicate-setlist-songs');
    const { data: teamSongs, error: songsError } = await supabase.from('songs').select('id').eq('team_id', DEMO_TEAM_ID).in('id', [...new Set(songIds)]);
    if (songsError || !teamSongs || songIds.some(id => !teamSongs.some(song => song.id === id))) {
        redirect('/dashboard/songs?error=invalid-setlist-songs');
    }

    const { error } = await supabase
        .from('setlists')
        .insert({
            team_id: DEMO_TEAM_ID,
            title,
            theme,
            worship_date: worshipDate.toISOString(),
            song_order: songIds,
        });

    if (error) {
        console.error('Failed to create setlist:', error);
        redirect('/dashboard/songs?error=create-setlist');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');
    redirect('/dashboard/songs?created=setlist');
}

export async function duplicateSetlistFromTemplate(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const setlistId = getString(formData, 'setlistId');

    if (!setlistId) {
        redirect('/dashboard/songs?error=missing-setlist-id');
    }

    const { data: setlist, error: fetchError } = await supabase
        .from('setlists')
        .select('title, theme, worship_date, song_order')
        .eq('id', setlistId)
        .eq('team_id', DEMO_TEAM_ID)
        .maybeSingle();

    if (fetchError || !setlist) {
        console.error('Failed to load setlist template:', fetchError);
        redirect('/dashboard/songs?error=duplicate-setlist');
    }

    const sourceDate = new Date(setlist.worship_date);
    const nextWorshipDate = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;
    nextWorshipDate.setDate(nextWorshipDate.getDate() + 7);
    const songOrder = normalizeSetlistSongOrder(setlist.song_order);
    if (!songOrder.length) redirect('/dashboard/songs?error=invalid-setlist-songs');

    const { error } = await supabase
        .from('setlists')
        .insert({
            team_id: DEMO_TEAM_ID,
            title: `${setlist.title} Copy`,
            theme: setlist.theme,
            worship_date: nextWorshipDate.toISOString(),
            song_order: songOrder,
        });

    if (error) {
        console.error('Failed to duplicate setlist template:', error);
        redirect('/dashboard/songs?error=duplicate-setlist');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');
    redirect('/dashboard/songs?created=template');
}

export async function updateSongBpmPreset(formData: FormData) {
    if (!configuredSupabase) redirect('/dashboard/songs?error=backend-unavailable');
    const supabase = getSupabaseClient();
    const songId = getString(formData, 'songId');
    const bpmValue = getNullableString(formData, 'bpm');
    const parsedBpm = bpmValue ? Number(bpmValue) : null;

    if (!songId) {
        redirect('/dashboard/songs?error=missing-song-id');
    }

    if (bpmValue && (parsedBpm === null || !Number.isInteger(parsedBpm) || parsedBpm < 20 || parsedBpm > 300)) {
        redirect('/dashboard/songs?error=invalid-bpm');
    }

    const { error } = await supabase
        .from('songs')
        .update({ bpm: parsedBpm })
        .eq('id', songId)
        .eq('team_id', DEMO_TEAM_ID);

    if (error) {
        console.error('Failed to update song BPM preset:', error);
        redirect('/dashboard/songs?error=update-song-bpm');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/songs');
    redirect('/dashboard/songs?created=bpm');
}

function getString(formData: FormData, key: string): string {
    return String(formData.get(key) ?? '').trim();
}

function getNullableString(formData: FormData, key: string): string | null {
    const value = getString(formData, key);
    return value.length > 0 ? value : null;
}
