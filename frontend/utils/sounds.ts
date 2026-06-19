import { Audio } from 'expo-av';

/**
 * Generate a short WAV tone as a base64 data URI.
 * No external audio files needed.
 */
function generateBeepUri(freq: number, durationMs: number = 150): string {
    const sampleRate = 8000;
    const numSamples = Math.floor(sampleRate * (durationMs / 1000));
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeStr = (off: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
    };
    const writeU16 = (off: number, v: number) => view.setUint16(off, v, true);
    const writeU32 = (off: number, v: number) => view.setUint32(off, v, true);

    writeStr(0, 'RIFF');
    writeU32(4, 36 + numSamples * 2);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    writeU32(16, 16);
    writeU16(20, 1);        // PCM
    writeU16(22, 1);        // mono
    writeU32(24, sampleRate);
    writeU32(28, sampleRate * 2);
    writeU16(32, 2);
    writeU16(34, 16);
    writeStr(36, 'data');
    writeU32(40, numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * freq * t);
        // Fade-out last 10ms to avoid click
        const fade = Math.min(1, ((durationMs - (t * 1000)) / 10));
        view.setInt16(44 + i * 2, Math.floor(sample * 0x7FFF * fade), true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(binary);
}

const SUCCESS_URI = generateBeepUri(880, 120);
const ERROR_URI = generateBeepUri(220, 300);

export function useScanSound() {
    const playSuccess = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri: SUCCESS_URI },
                { shouldPlay: true }
            );
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && (status.didJustFinish || (status.positionMillis ?? 0) >= 250)) {
                    sound.unloadAsync().catch(() => {});
                }
            });
        } catch {}
    };

    const playError = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri: ERROR_URI },
                { shouldPlay: true }
            );
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && (status.didJustFinish || (status.positionMillis ?? 0) >= 500)) {
                    sound.unloadAsync().catch(() => {});
                }
            });
        } catch {}
    };

    return { playSuccess, playError };
}
