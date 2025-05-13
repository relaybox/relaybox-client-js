/**
 * PKCE LocalStorage keys
 */
export const PKCE_STATE_KEY = '__rb__prefix_pkce_state';
export const PKCE_VERIFIER_KEY = '__rb__prefix_pkce_code_verifier';
export const PKCE_REDIRECT_URI_KEY = '__rb__prefix_pkce_redirect_uri';
export const PKCE_ORIGINAL_URL_KEY = '__rb__prefix_pkce_original_url';

/**
 * Generates a cryptographically random string for the PKCE code_verifier.
 * @param length The length of the string to generate.
 * @returns A random string.
 */
export function generateRandomString(length: number): string {
  const array = new Uint32Array(Math.ceil(length / 2));

  window.crypto.getRandomValues(array);

  return Array.from(array, (dec) => ('0' + dec.toString(16)).slice(-2))
    .join('')
    .slice(0, length);
}

/**
 * Generates the PKCE code_challenge from a code_verifier.
 * Uses SHA-256 hashing then Base64URL encoding.
 * @param verifier The code_verifier.
 * @returns A Promise resolving to the code_challenge.
 */
export async function generateCodeChallengeFromVerifier(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);

  let base64 = window.btoa(String.fromCharCode(...new Uint8Array(digest)));

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Helper to create both verifier and challenge
 */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallengeFromVerifier(verifier);

  return {
    verifier,
    challenge
  };
}
