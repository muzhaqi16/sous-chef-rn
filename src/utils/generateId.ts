import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4 using the uuid library
 *
 * Uses react-native-get-random-values polyfill for React Native compatibility.
 * Provides cryptographically secure, spec-compliant UUIDs.
 */
export function generateId(): string {
  return uuidv4();
}
