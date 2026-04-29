import crypto from 'crypto';

/**
 * Generates a cryptographically random state string (hex-encoded, 32 bytes → 64 hex chars).
 * Used as the OAuth `state` parameter to prevent CSRF attacks.
 *
 * @returns {string} A 64-character hex string.
 */
export function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a PKCE code verifier — a cryptographically random base64url string.
 * RFC 7636 requires 43–128 characters. We use 64 bytes → 86 base64url chars.
 *
 * @returns {string} A base64url-encoded random string (no padding).
 */
export function generateCodeVerifier() {
  return crypto
    .randomBytes(64)
    .toString('base64url'); // Node.js 16+ supports 'base64url' directly
}

/**
 * Derives the PKCE code challenge from a verifier using S256 method.
 * Challenge = BASE64URL(SHA256(ASCII(verifier)))
 *
 * @param {string} verifier - The code verifier produced by generateCodeVerifier().
 * @returns {string} A base64url-encoded SHA-256 hash of the verifier (no padding).
 */
export function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier, 'ascii')
    .digest('base64url');
}
