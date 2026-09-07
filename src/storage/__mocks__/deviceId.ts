/**
 * Shared test mock for `#/storage/deviceId`.
 *
 * Activated per-suite via a bare `jest.mock('#/storage/deviceId')` (no
 * factory). Both accessors answer with the SAME value, so a suite cannot pass
 * by presenting one identity synchronously and another asynchronously — the
 * divergence this module exists to prevent.
 *
 * To exercise a device with no identity:
 *
 *   ```ts
 *   (ensureDeviceId as jest.Mock).mockResolvedValue(null);
 *   (getDeviceId as jest.Mock).mockReturnValue(null);
 *   ```
 */

/** The identity every suite sees unless it overrides one of the accessors. */
export const MOCK_DEVICE_ID = 'device_test';

export const getDeviceId = jest.fn<string | null, []>(() => MOCK_DEVICE_ID);

export const ensureDeviceId = jest.fn<Promise<string | null>, []>(() =>
  Promise.resolve(MOCK_DEVICE_ID),
);

/**
 * No legacy row to retire by default — the fresh-install case. A suite that
 * exercises the migration returns a value from `readLegacyDeviceFingerprint`.
 */
export const readLegacyDeviceFingerprint = jest.fn<string | null, []>(
  () => null,
);

export const clearLegacyDeviceFingerprint = jest.fn<void, []>(() => undefined);
