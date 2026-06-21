import { Platform } from 'react-native';

// Singleton AudioContext — reuse across calls. Mobile browsers block
// freshly-created contexts in non-gesture callbacks.
let _audioCtx: AudioContext | null = null;
let _audioUnlocked = false;
// Track active oscillator for rapid-scan cancellation
let _activeOsc: OscillatorNode | null = null;
let _activeGain: GainNode | null = null;

function getAudioCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!_audioCtx) _audioCtx = new Ctor() as AudioContext;
    return _audioCtx;
}

/**
 * Call once inside a user-gesture handler (onPress / onClick) to satisfy
 * mobile browsers' autoplay policy. Safe to call multiple times — no-ops
 * after first successful resume.
 */
export async function ensureAudioUnlocked(): Promise<void> {
    if (_audioUnlocked) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
        // Firefox requires await — fire-and-forget silently fails
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        // Play silent 1-sample buffer to fully unlock on iOS Safari
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        _audioUnlocked = true;
    } catch {
        // Audio unavailable — degrade silently
    }
}

function vibrateFallback(ms: number) {
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(ms);
        }
    } catch {}
}

async function playWebBeep(freq: number, durationMs: number) {
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        // Firefox: must await resume() before creating oscillator, or beep silently fails
        if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
        }
        // Cancel prior beep to prevent overlapping tones on rapid scan
        if (_activeOsc && _activeGain) {
            try {
                _activeOsc.onended = null;
                _activeOsc.stop(ctx.currentTime);
                _activeOsc.disconnect();
                _activeGain.disconnect();
            } catch {}
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        _activeOsc = osc;
        _activeGain = gain;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.85, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
        osc.onended = () => {
            if (_activeOsc === osc) {
                _activeOsc = null;
                _activeGain = null;
            }
        };
    } catch {
        vibrateFallback(durationMs);
    }
}

async function playNativeBeep(freq: number, durationMs: number) {
    try {
        const { Audio } = await import('expo-av');
        const sampleRate = 8000;
        const numSamples = Math.floor(sampleRate * (durationMs / 1000));
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);
        const w = (off: number, v: number, is32 = false) => { is32 ? view.setUint32(off, v, true) : view.setUint16(off, v, true); };
        const s = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        s(0, 'RIFF'); w(4, 36 + numSamples * 2, true); s(8, 'WAVE');
        s(12, 'fmt '); w(16, 16, true); w(20, 1); w(22, 1);
        w(24, sampleRate, true); w(28, sampleRate * 2, true); w(32, 2); w(34, 16);
        s(36, 'data'); w(40, numSamples * 2, true);
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const fade = Math.min(1, ((durationMs - (t * 1000)) / 10));
            view.setInt16(44 + i * 2, Math.floor(Math.sin(2 * Math.PI * freq * t) * 0x7FFF * fade), true);
        }
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const uri = 'data:audio/wav;base64,' + btoa(binary);
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        const timeout = durationMs + 200;
        const start = Date.now();
        sound.setOnPlaybackStatusUpdate(() => {
            if (Date.now() - start > timeout) sound.unloadAsync().catch(() => {});
        });
    } catch {}
}

export function useScanSound() {
    const playSuccess = async () => {
        if (Platform.OS === 'web') {
            await ensureAudioUnlocked();
            playWebBeep(880, 120);
            vibrateFallback(50);
        } else {
            await playNativeBeep(880, 120);
        }
    };
    const playError = async () => {
        if (Platform.OS === 'web') {
            await ensureAudioUnlocked();
            playWebBeep(220, 300);
            vibrateFallback(150);
        } else {
            await playNativeBeep(220, 300);
        }
    };
    return { playSuccess, playError };
}
