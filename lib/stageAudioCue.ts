/**
 * stageAudioCue.ts
 *
 * Lightweight Web Audio API synthesizer for live worship stage in-ear audio cues.
 * Provides subtle, polite auditory signals for musicians (especially drummers/keys/guitarists)
 * when non-verbal cues arrive (tempo change, volume request, section advance, test ping).
 *
 * Zero external audio assets required; safe for SSR / Node test runners.
 */

const AUDIO_ENABLED_STORAGE_KEY = 'wt_stage_audio_cue_enabled';
const AUDIO_VOLUME_STORAGE_KEY = 'wt_stage_audio_cue_volume';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!audioCtx || audioCtx.state === 'closed') {
        try {
            audioCtx = new AudioCtxClass();
        } catch {
            return null;
        }
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }

    return audioCtx;
}

export function isStageAudioEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const stored = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY);
        // Default to enabled (true) if not set, or false if user explicitly turned off
        return stored !== 'false';
    } catch {
        return true;
    }
}

export function setStageAudioEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {}
}

export function getStageAudioVolume(): number {
    if (typeof window === 'undefined') return 0.25;
    try {
        const stored = window.localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY);
        if (!stored) return 0.25;
        const parsed = parseFloat(stored);
        return Number.isFinite(parsed) ? Math.max(0.05, Math.min(1.0, parsed)) : 0.25;
    } catch {
        return 0.25;
    }
}

export function setStageAudioVolume(volume: number): void {
    if (typeof window === 'undefined') return;
    try {
        const clamped = Math.max(0.05, Math.min(1.0, volume));
        window.localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, clamped.toFixed(2));
    } catch {}
}

/**
 * Play an auditory chime in ear monitors matching the cue category.
 */
export function playStageCueSound(
    category: 'tempo' | 'sound' | 'flow' | 'band' | 'media' | 'system' = 'flow',
    overrideVolume?: number
): void {
    if (!isStageAudioEnabled()) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const masterVol = typeof overrideVolume === 'number' ? overrideVolume : getStageAudioVolume();
    const now = ctx.currentTime;

    try {
        switch (category) {
            case 'tempo': {
                // High alert double-beep: 880Hz (A5) -> 1175Hz (D6)
                playTone(ctx, 880, now, 0.05, masterVol * 0.4);
                playTone(ctx, 1175, now + 0.07, 0.07, masterVol * 0.5);
                break;
            }
            case 'sound': {
                // Soft chime chord: C5 (523Hz) + G5 (784Hz)
                playTone(ctx, 523.25, now, 0.12, masterVol * 0.35, 'triangle');
                playTone(ctx, 783.99, now + 0.04, 0.14, masterVol * 0.3, 'sine');
                break;
            }
            case 'system': {
                // High crisp ping: A6 (1760Hz)
                playTone(ctx, 1760, now, 0.04, masterVol * 0.35, 'sine');
                break;
            }
            case 'band': {
                // Triad chord: E4 (329.6Hz) -> A4 (440Hz)
                playTone(ctx, 329.63, now, 0.08, masterVol * 0.3, 'triangle');
                playTone(ctx, 440, now + 0.05, 0.12, masterVol * 0.35, 'sine');
                break;
            }
            case 'media': {
                // Gentle pulse: 659Hz (E5)
                playTone(ctx, 659.25, now, 0.09, masterVol * 0.3, 'sine');
                break;
            }
            case 'flow':
            default: {
                // Pleasant major third: A4 (440Hz) -> C#5 (554.37Hz)
                playTone(ctx, 440, now, 0.08, masterVol * 0.35, 'sine');
                playTone(ctx, 554.37, now + 0.06, 0.12, masterVol * 0.4, 'sine');
                break;
            }
        }
    } catch {
        // Audio synthesis failure should never crash the stage session
    }
}

function playTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    gainLevel: number,
    type: OscillatorType = 'sine'
) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}
