import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4 using the uuid library
 *
 * Provides cryptographically secure, spec-compliant UUIDs.
 * Uses crypto.getRandomValues() provided natively by Hermes.
 */
export function generateId(): string {
  return uuidv4();
}
