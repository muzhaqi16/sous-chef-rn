/**
 * Did THIS device cause the event? `originatorClientId` — the server echoing the
 * mutation's `x-device-id` — is the right test, since what has already been
 * applied is the mutation's own response. `actorUserId` is the coarser fallback
 * for unstamped envelopes: it also drops events from the user's OTHER devices.
 */

import { getDeviceIdSync } from '#/utils/deviceId';

interface EchoFields {
  actorUserId?: string | null;
  originatorClientId?: string | null;
}

export function isSelfEcho(
  payload: EchoFields,
  userId: string | undefined,
): boolean {
  const originator = payload.originatorClientId;
  if (originator) {
    const deviceId = getDeviceIdSync();
    return deviceId !== null && originator === deviceId;
  }

  return Boolean(
    payload.actorUserId && userId && payload.actorUserId === userId,
  );
}
