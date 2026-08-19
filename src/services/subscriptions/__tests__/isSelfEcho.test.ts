/**
 * Echo suppression must key on the DEVICE, not the user — otherwise the same
 * account signed in twice stops updating in real time.
 */
import { isSelfEcho } from '../isSelfEcho';
import { getDeviceIdSync } from '#/utils/deviceId';

jest.mock('#/utils/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'device_this'),
}));

describe('isSelfEcho', () => {
  it('drops an event this device caused', () => {
    expect(
      isSelfEcho(
        { actorUserId: 'user-1', originatorClientId: 'device_this' },
        'user-1',
      ),
    ).toBe(true);
  });

  it('KEEPS an event the same user caused on another device', () => {
    // The whole point: the mutation response landed on the other device, not
    // this one, so this one has nothing applied yet.
    expect(
      isSelfEcho(
        { actorUserId: 'user-1', originatorClientId: 'device_other' },
        'user-1',
      ),
    ).toBe(false);
  });

  it('keeps an event another user caused', () => {
    expect(
      isSelfEcho(
        { actorUserId: 'user-2', originatorClientId: 'device_other' },
        'user-1',
      ),
    ).toBe(false);
  });

  it('falls back to the user when the server sent no originator', () => {
    // Envelopes the server does not stamp yet. Coarser, and the reason the
    // originator check comes first.
    expect(isSelfEcho({ actorUserId: 'user-1' }, 'user-1')).toBe(true);
    expect(isSelfEcho({ actorUserId: 'user-2' }, 'user-1')).toBe(false);
  });

  it('keeps the event when this device has no id yet', () => {
    (getDeviceIdSync as jest.Mock).mockReturnValueOnce(null);
    // Applying a redundant update beats dropping a real one.
    expect(
      isSelfEcho(
        { actorUserId: 'user-1', originatorClientId: 'device_this' },
        'user-1',
      ),
    ).toBe(false);
  });
});
