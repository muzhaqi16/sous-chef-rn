import { isRecord } from '#/utils/isRecord';

export const versionOf = (record: unknown): number | undefined =>
  isRecord(record) && typeof record.version === 'number'
    ? record.version
    : undefined;

/** The version the server returned for `entityId`, wherever the payload holds it. */
export const returnedVersionOf = (
  payload: unknown,
  entityId: string,
): number | undefined => {
  if (isRecord(payload) && payload.id === entityId) {
    const own = versionOf(payload);
    if (own !== undefined) return own;
  }
  const children: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload)
    ? Object.values(payload)
    : [];
  for (const child of children) {
    const found = returnedVersionOf(child, entityId);
    if (found !== undefined) return found;
  }
  return undefined;
};
