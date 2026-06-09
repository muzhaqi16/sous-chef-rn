import { createId } from '@paralleldrive/cuid2';

/**
 * Generate a client-side PERMANENT entity id for local-first creates.
 *
 * Emits **cuid2** (`@paralleldrive/cuid2`), matching the backend's current
 * Prisma `@default(cuid(2))` format so a client-minted id is indistinguishable
 * from a server-generated one. The server's id validator
 * (`/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/`) accepts both cuid2 and the
 * older cuid v1 (`c` + 24 chars), so ids minted by a previous app version stay
 * valid; only new ids use cuid2.
 *
 * The same value is sent as the create `input.id` (the server stores it as the
 * PK) AND as the offline-sync `clientId`, so a re-sent create converges to the
 * same row via the server's find-by-id → update sync path — no duplicates, no
 * temp→real reconciliation.
 *
 * Do NOT use `generateId()` (uuid v4) for entity PKs — wrong format and poor
 * Postgres index locality.
 */
export function generateEntityId(): string {
  return createId();
}
