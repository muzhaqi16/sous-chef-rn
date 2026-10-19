import { createMMKV, existsMMKV } from 'react-native-mmkv';
import { RETIRED_PERSISTED_KEYS } from '#/store/persistedKeys';
import { purgeRecoveryStorage } from '../mmkv';

jest.mock('#native/storage/deviceKey', () => ({
  DeviceKeyManager: {
    getDeviceEncryptionKey: jest.fn(async () => ({
      key: 'test-encryption-key',
      encryptionType: 'AES-256',
    })),
  },
}));

/**
 * The recovery store exists only after a key outage quarantined a session.
 * Probing for it with a call that CREATES it turns the cleanup into the thing
 * being cleaned up, on every device that never had an outage.
 */
describe('purgeRecoveryStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not open the recovery store when there is none', () => {
    jest.mocked(existsMMKV).mockReturnValue(false);

    purgeRecoveryStorage();

    expect(createMMKV).not.toHaveBeenCalled();
  });

  it('clears the recovery store when one is there', () => {
    jest.mocked(existsMMKV).mockReturnValue(true);
    const instance = { getAllKeys: () => ['k'], clearAll: jest.fn() };
    jest.mocked(createMMKV).mockReturnValueOnce(instance as never);

    purgeRecoveryStorage();

    expect(instance.clearAll).toHaveBeenCalled();
  });
});

describe('startup cleanup', () => {
  const realIdle = Object.getOwnPropertyDescriptor(
    globalThis,
    'requestIdleCallback',
  );
  afterEach(() => {
    if (realIdle)
      Object.defineProperty(globalThis, 'requestIdleCallback', realIdle);
    else Reflect.deleteProperty(globalThis, 'requestIdleCallback');
  });

  it('removes what a retired store persisted, without waiting for a sign-out', async () => {
    Object.assign(globalThis, {
      requestIdleCallback: (callback: () => void) => callback(),
    });
    const remove = jest.fn();
    let mmkv!: typeof import('../mmkv');
    // Test mode opens the instance eagerly; a launch opens it through init.
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.isolateModules(() => {
      const native =
        jest.requireMock<typeof import('react-native-mmkv')>(
          'react-native-mmkv',
        );
      jest.mocked(native.existsMMKV).mockReturnValue(false);
      jest
        .mocked(native.createMMKV)
        .mockReturnValue({ getAllKeys: () => ['k'], remove } as never);
      mmkv = jest.requireActual<typeof import('../mmkv')>('../mmkv');
    });
    process.env.NODE_ENV = env;

    await mmkv.initializeSecureStorage();

    expect(RETIRED_PERSISTED_KEYS.length).toBeGreaterThan(0);
    for (const key of RETIRED_PERSISTED_KEYS) {
      expect(remove).toHaveBeenCalledWith(key);
    }
  });
});
