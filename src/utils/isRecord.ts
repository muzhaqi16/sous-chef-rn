/** Narrows an opaque value to an indexable object, so no `any` is needed. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
