/**
 * Self-check for the split auth payload.
 * Run: npx ts-node --transpile-only store/authStorageSplit.test.ts
 */
import {
    SECURE_STORE_MAX_BYTES,
    buildSecureSlice,
    extractPersistedToken,
    mergeSecureToken,
} from './authStorageSplit';

const assert = (label: string, condition: boolean) => {
    if (!condition) {
        throw new Error(`FAIL: ${label}`);
    }
};

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
const full = JSON.stringify({
    state: {
        token: TOKEN,
        user: { id: 7, nama: 'Budi', profile_picture: 'x'.repeat(4000) },
        isAuthenticated: true,
    },
    version: 0,
});

// Extracting the token from a full payload, and rejecting junk.
assert('extract token', extractPersistedToken(full) === TOKEN);
assert('extract from junk is null', extractPersistedToken('not json') === null);
assert('extract from tokenless payload is null',
    extractPersistedToken(JSON.stringify({ state: { user: {} } })) === null);

// The secure slice round-trips through the same extractor.
const slice = buildSecureSlice(TOKEN);
assert('slice is small enough for SecureStore', slice.length <= SECURE_STORE_MAX_BYTES);
assert('slice extracts back to the token', extractPersistedToken(slice) === TOKEN);

// Recombining: secure token wins, everything else survives.
const merged = JSON.parse(mergeSecureToken(slice, full));
assert('merged keeps the encrypted token', merged.state.token === TOKEN);
assert('merged keeps the user blob', merged.state.user.id === 7);
assert('merged keeps isAuthenticated', merged.state.isAuthenticated === true);
assert('merged keeps version', merged.version === 0);

// When SecureStore holds the whole payload it wins outright.
const fullInSecure = mergeSecureToken(full, full);
assert('full secure payload wins', extractPersistedToken(fullInSecure) === TOKEN);

// Unparseable plaintext still yields the secure token rather than throwing.
const fallback = mergeSecureToken(slice, 'corrupt');
assert('corrupt plaintext still parses', extractPersistedToken(fallback) === TOKEN);

console.log('authStorageSplit.test.ts: all checks passed');
