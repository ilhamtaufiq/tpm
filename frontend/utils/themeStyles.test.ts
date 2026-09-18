/**
 * Lightweight self-check (no Jest). Run: npx tsx utils/themeStyles.test.ts
 */
import { colorPalettes } from '../store/useUIStore';
import { placeholderColor, sheetChrome } from './themeStyles';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

const midnight = colorPalettes.find((p) => p.id === 'midnight');
const graphite = colorPalettes.find((p) => p.id === 'graphite');
const tpm = colorPalettes.find((p) => p.id === 'tpm');
if (!midnight || !graphite || !tpm) throw new Error('palet Midnight/Graphite/TPM hilang');

const WHITE = '#FFFFFF';
const HARDCODED_PLACEHOLDER = '#9CA3AF';
const HARDCODED_HANDLE = '#E5E7EB';

for (const palette of [midnight, graphite]) {
    const chrome = sheetChrome(palette.colors);
    assert(
        chrome.backgroundStyle.backgroundColor !== WHITE,
        `${palette.name} sheet background masih putih`,
    );
    assert(
        chrome.backgroundStyle.backgroundColor === palette.colors.surface,
        `${palette.name} sheet background harus surface palet`,
    );
    assert(
        chrome.handleIndicatorStyle.backgroundColor === palette.border,
        `${palette.name} handle harus border palet, bukan ${HARDCODED_HANDLE}`,
    );
    assert(
        placeholderColor(palette.colors) === palette.colors.textGray,
        `${palette.name} placeholder harus textGray`,
    );
    assert(
        placeholderColor(palette.colors) !== HARDCODED_PLACEHOLDER,
        `${palette.name} placeholder masih ${HARDCODED_PLACEHOLDER}`,
    );
}

const tpmChrome = sheetChrome(tpm.colors, { borderRadius: 32 });
assert(tpmChrome.backgroundStyle.backgroundColor === tpm.colors.surface, 'TPM sheet surface');
assert(tpmChrome.backgroundStyle.borderRadius === 32, 'sheetChrome meneruskan borderRadius');
assert(placeholderColor(tpm.colors) === tpm.colors.textGray, 'TPM placeholder textGray');

console.log('themeStyles.test.ts ok');
