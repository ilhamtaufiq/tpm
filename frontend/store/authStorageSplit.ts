/**
 * Helpers for splitting the persisted auth payload across two stores.
 *
 * SecureStore has a 2048-byte cap on iOS. When the payload exceeds it we keep
 * the token encrypted on its own and spill the bulky `user` blob to
 * AsyncStorage, rather than dumping the token there in plaintext.
 *
 * Payload shape is zustand persist's: {state: {...}, version: n}.
 */

export const SECURE_STORE_MAX_BYTES = 2048;

export const extractPersistedToken = (value: string): string | null => {
    try {
        const token = JSON.parse(value)?.state?.token;
        if (typeof token !== 'string' || !token) {
            return null;
        }
        return token;
    } catch {
        return null;
    }
};

/** Build the encrypted slice written to SecureStore. */
export const buildSecureSlice = (token: string): string =>
    JSON.stringify({ state: { token } });

/**
 * Recombine the split payload: the encrypted slice supplies the token,
 * the plaintext blob supplies everything else.
 */
export const mergeSecureToken = (secureValue: string, plainValue: string): string => {
    const token = extractPersistedToken(secureValue);
    if (!token) {
        // SecureStore holds the full payload — it wins.
        return secureValue;
    }

    try {
        const parsed = JSON.parse(plainValue);
        if (!parsed?.state) {
            // Plaintext is unusable — keep the authenticated session alive.
            return secureValue;
        }
        return JSON.stringify({
            ...parsed,
            state: { ...parsed.state, token },
        });
    } catch {
        // Corrupt plaintext: prefer the encrypted slice over losing the session.
        return secureValue;
    }
};
