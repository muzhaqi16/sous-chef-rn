/**
 * Did THIS device cause the event?
 *
 * `originatorClientId` is the device that made the change — the server echoes
 * back the `x-device-id` header the mutation carried (`authLink`), and the same
 * id keys the socket (`wsLink`). That is the right test, because the thing
 * already applied is the mutation's own response, and that landed on this
 * device only.
 *
 * `actorUserId` is the fallback for envelopes the server does not stamp with an
 * originator yet. It is coarser and wrong in one specific way: it also drops
 * events the same USER caused on a DIFFERENT device, so a second signed-in
 * device stops updating in real time. Keeping it second means each envelope
 * improves the moment the server starts stamping it, with no client change.
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
