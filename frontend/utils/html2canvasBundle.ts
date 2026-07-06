import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Bundled offline — avoids CDN failure that caused text-only fallback prints.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTML2CANVAS_ASSET = require('../assets/html2canvas.min.txt');

let cachedScript: string | null = null;
let loadPromise: Promise<string> | null = null;

export function getHtml2CanvasScript(): Promise<string> {
    if (cachedScript) {
        return Promise.resolve(cachedScript);
    }

    if (!loadPromise) {
        loadPromise = (async () => {
            const asset = Asset.fromModule(HTML2CANVAS_ASSET);
            await asset.downloadAsync();
            const uri = asset.localUri ?? asset.uri;
            if (!uri) {
                throw new Error('Bundle html2canvas tidak ditemukan di APK.');
            }

            const script = await FileSystem.readAsStringAsync(uri);
            if (!script || script.length < 1000) {
                throw new Error('Bundle html2canvas rusak atau kosong.');
            }

            cachedScript = script;
            return script;
        })().finally(() => {
            loadPromise = null;
        });
    }

    return loadPromise;
}

export function preloadHtml2CanvasScript(): void {
    getHtml2CanvasScript().catch((error) => {
        console.warn('[Print] html2canvas preload failed:', error);
    });
}