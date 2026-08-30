import { v4 as uuidv4 } from 'uuid';

/**
 * UUID v4 over `crypto.getRandomValues()`, polyfilled by
 * react-native-get-random-values at the top of index.js.
 */
export function generateId(): string {
  return uuidv4();
}
