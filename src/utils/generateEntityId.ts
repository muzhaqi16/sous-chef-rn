import { createId } from '@paralleldrive/cuid2';

/**
 * A client-side PERMANENT entity id for local-first creates: cuid2, matching the
 * backend's `@default(cuid(2))`. Sent as the create's `input.id`, the row's
 * primary key, so a re-sent create converges on the same row. Never
 * `generateId()` (uuid v4) for a PK — wrong format, poor index locality.
 */
export function generateEntityId(): string {
  return createId();
}
