/** Unique values for specs that create records. */

export function generateItemName(prefix = 'E2E'): string {
  return `${prefix} Item ${Date.now()}`;
}

export function generateTestEmail(): string {
  return `test.user.${Date.now()}@example.com`;
}
