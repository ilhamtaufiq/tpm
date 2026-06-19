import { Platform } from 'react-native';

function playWebBeep(freq: number, durationMs: number) {
    try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
        osc.onended = () => ctx.close();
    } catch {}
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
        if (Platform.OS === 'web') playWebBeep(880, 120);
        else await playNativeBeep(880, 120);
    };
    const playError = async () => {
        if (Platform.OS === 'web') playWebBeep(220, 300);
        else await playNativeBeep(220, 300);
    };
    return { playSuccess, playError };
}
