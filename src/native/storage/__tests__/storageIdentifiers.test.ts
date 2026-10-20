import { createMMKV } from 'react-native-mmkv';
import { RECOVERY_STORAGE_KEY } from '../mmkv';
import { RETIRED_PERSISTED_KEYS, STORAGE_KEY } from '#/store/persistedKeys';

jest.mock('#native/storage/deviceKey', () => ({
  DeviceKeyManager: {
    getDeviceEncryptionKey: jest.fn(async () => ({
      key: 'test-encryption-key',
      encryptionType: 'AES-256',
    })),
  },
}));

/**
 * The strings this app has shipped for what is on disk. MMKV opens a file by
 * its id and the root store reads its blob by key, so changing one strands
 * every installed user's data: signed in, preferences and the offline queue
 * are gone at the next launch, and nothing fails at build time. A change here
 * is a migration, not an edit. The keychain's names are pinned in
 * `keychainServiceNames.test.ts`.
 */
describe('storage identifiers', () => {
  it('are exactly the ids and keys this app has shipped', () => {
    // The MMKV file's id and the root store's key are one constant.
    expect(STORAGE_KEY).toBe('sous-chef-storage');
    expect(RECOVERY_STORAGE_KEY).toBe('sous-chef-storage-recovery');
    expect(RETIRED_PERSISTED_KEYS).toEqual(['sous-chef-barcode']);
  });

  it('opens the encrypted file under that id, with the key and its cipher', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let mmkv!: typeof import('../mmkv');
    jest.isolateModules(() => {
      mmkv = jest.requireActual<typeof import('../mmkv')>('../mmkv');
    });
    process.env.NODE_ENV = env;
    jest.mocked(createMMKV).mockClear();

    await mmkv.initializeSecureStorage();

    expect(createMMKV).toHaveBeenCalledWith({
      id: 'sous-chef-storage',
      encryptionKey: 'test-encryption-key',
      encryptionType: 'AES-256',
    });
  });
});
