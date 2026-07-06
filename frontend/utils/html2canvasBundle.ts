import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Bundled offline — avoids CDN failure that caused text-only fallback prints.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTML2CANVAS_ASSET = require('../assets/html2canvas.min.txt');

export const HTML2CANVAS_CACHE_FILENAME = 'html2canvas.min.js';

let cachedScript: string | null = null;
let loadPromise: Promise<string> | null = null;
let cacheFilePromise: Promise<string> | null = null;

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

/**
 * Writes html2canvas to app cache and returns the directory URI for WebView baseUrl.
 */
export async function ensureHtml2CanvasCacheBaseUrl(): Promise<string> {
    if (cacheFilePromise) {
        return cacheFilePromise;
    }

    cacheFilePromise = (async () => {
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
            throw new Error('Cache aplikasi tidak tersedia untuk render struk.');
        }

        const script = await getHtml2CanvasScript();
        const fileUri = `${cacheDir}${HTML2CANVAS_CACHE_FILENAME}`;
        const info = await FileSystem.getInfoAsync(fileUri);

        if (!info.exists) {
            await FileSystem.writeAsStringAsync(fileUri, script, {
                encoding: FileSystem.EncodingType.UTF8,
            });
        }

        return cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
    })().finally(() => {
        cacheFilePromise = null;
    });

    return cacheFilePromise;
}

export function preloadHtml2CanvasScript(): void {
    ensureHtml2CanvasCacheBaseUrl().catch((error) => {
        console.warn('[Print] html2canvas preload failed:', error);
    });
}