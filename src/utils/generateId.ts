/**
 * Generate a UUID v4 using the native Web Crypto API
 *
 * Available in React Native 0.74+ with Hermes engine.
 * Provides cryptographically secure, spec-compliant UUIDs.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
