import cuid from '@bugsnag/cuid';

/**
 * Generate a client-side PERMANENT entity id for local-first creates.
 *
 * Emits classic **cuid v1** (`/^c[a-z0-9]{24}$/`) to match the backend's Prisma
 * `@default(cuid())` format, so a client-minted id is indistinguishable from a
 * server-generated one. The same value is sent as the create `input.id` (the
 * server stores it as the PK) AND as the offline-sync `clientId`, so a re-sent
 * create converges to the same row via the server's find-by-id → update sync
 * path — no duplicates, no temp→real reconciliation.
 *
 * Do NOT use `generateId()` (uuid v4) for entity PKs — wrong format and poor
 * Postgres index locality. cuid2 (`@paralleldrive/cuid2`, also in node_modules)
 * is a DIFFERENT format that fails the server's regex — use this v1 generator.
 */
export function generateEntityId(): string {
  return cuid();
}
