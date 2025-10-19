import { webcrypto } from 'crypto';

/**
 * Generate a cryptographically secure random token
 * @param bytes Number of random bytes (default: 32)
 * @returns Base64URL encoded token
 */
export function generateToken(bytes: number = 32): string {
  const randomBytes = webcrypto.getRandomValues(new Uint8Array(bytes));
  return Buffer.from(randomBytes).toString('base64url');
}

/**
 * Hash a token using SHA-256
 * @param token The token to hash
 * @returns Base64URL encoded hash
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer).toString('base64url');
}

/**
 * Verify if a token matches a hash
 * @param token The token to verify
 * @param hash The hash to compare against
 * @returns True if token matches hash
 */
export async function verifyToken(token: string, hash: string): Promise<boolean> {
  const computedHash = await hashToken(token);
  return computedHash === hash;
}
