import { isStorageReady, isRecoveryStorage, storage } from '#/storage/mmkv';
import { loadDeviceId, saveDeviceId } from '#/storage/keychain';

jest.mock('#/storage/mmkv');
jest.mock('#/storage/keychain', () => ({
  loadDeviceId: jest.fn(),
  saveDeviceId: jest.fn(),
}));

const { __mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

const mockLoad = loadDeviceId as jest.MockedFunction<typeof loadDeviceId>;
const mockSave = saveDeviceId as jest.MockedFunction<typeof saveDeviceId>;

// The module memoizes, so each case re-imports it to start from a cold cache.
const loadModule = () => {
  let mod!: typeof import('#/storage/deviceId');
  jest.isolateModules(() => {
    mod = require('#/storage/deviceId');
  });
  return mod;
};

beforeEach(() => {
  __mockStore.clear();
  jest.clearAllMocks();
  (isStorageReady as jest.Mock).mockReturnValue(true);
  (isRecoveryStorage as jest.Mock).mockReturnValue(false);
  mockLoad.mockResolvedValue({ status: 'absent' });
  mockSave.mockResolvedValue(true);
});

describe('getDeviceId', () => {
  it('returns null before storage opens', () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);

    expect(loadModule().getDeviceId()).toBeNull();
  });

  it('mints nothing, so a cold cache reads as absent rather than as a new device', () => {
    expect(loadModule().getDeviceId()).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
    expect(__mockStore.size).toBe(0);
  });

  it('reads back a value an earlier launch stored', () => {
    __mockStore.set('device_id', 'device_stored');

    expect(loadModule().getDeviceId()).toBe('device_stored');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('memoizes, so the header path pays one storage read per launch', () => {
    __mockStore.set('device_id', 'device_stored');
    const { getDeviceId } = loadModule();

    expect(getDeviceId()).toBe(getDeviceId());
    expect(storage.getString).toHaveBeenCalledTimes(1);
  });

  // The recovery instance opens unencrypted when the device key is unavailable
  // and is erased on the next healthy launch, so a value read or written there
  // belongs to no install.
  it('reports absent on the recovery instance rather than reading it', () => {
    __mockStore.set('device_id', 'device_from_a_discarded_file');
    (isRecoveryStorage as jest.Mock).mockReturnValue(true);

    expect(loadModule().getDeviceId()).toBeNull();
  });

  it('writes nothing to the recovery instance', () => {
    (isRecoveryStorage as jest.Mock).mockReturnValue(true);

    loadModule().getDeviceId();

    expect(storage.set).not.toHaveBeenCalled();
    expect(__mockStore.size).toBe(0);
  });

  it('is at most 128 characters, past which the server reads it as absent', async () => {
    const { ensureDeviceId } = loadModule();

    expect((await ensureDeviceId())!.length).toBeLessThanOrEqual(128);
  });
});

describe('ensureDeviceId', () => {
  it('mints on a device that has none', async () => {
    const id = await loadModule().ensureDeviceId();

    expect(id).toEqual(expect.stringMatching(/^device_/));
    expect(__mockStore.get('device_id')).toBe(id);
    expect(mockSave).toHaveBeenCalledWith(id);
  });

  it('reaches durable storage before it reaches the mirror', async () => {
    let mirroredAtSaveTime: boolean | null = null;
    mockSave.mockImplementation(async () => {
      mirroredAtSaveTime = __mockStore.has('device_id');
      return true;
    });

    const id = await loadModule().ensureDeviceId();

    expect(mirroredAtSaveTime).toBe(false);
    expect(__mockStore.get('device_id')).toBe(id);
  });

  it('restores the identifier the keychain holds when the mirror is empty', async () => {
    mockLoad.mockResolvedValue({ status: 'ok', deviceId: 'device_durable' });

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_durable');
    expect(__mockStore.get('device_id')).toBe('device_durable');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('writes an install that predates the keychain copy through to it', async () => {
    __mockStore.set('device_id', 'device_stored');

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_stored');
    expect(mockSave).toHaveBeenCalledWith('device_stored');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('serves the durable identifier during a storage outage without mirroring it', async () => {
    (isRecoveryStorage as jest.Mock).mockReturnValue(true);
    mockLoad.mockResolvedValue({ status: 'ok', deviceId: 'device_durable' });

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_durable');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('does not mint when the durable read fails', async () => {
    mockLoad.mockResolvedValue({ status: 'error' });

    expect(await loadModule().ensureDeviceId()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(__mockStore.size).toBe(0);
  });

  it('presents the identifier the device already had once the read recovers', async () => {
    mockLoad.mockResolvedValueOnce({ status: 'error' });
    const { ensureDeviceId } = loadModule();

    expect(await ensureDeviceId()).toBeNull();

    mockLoad.mockResolvedValue({ status: 'ok', deviceId: 'device_durable' });

    expect(await ensureDeviceId()).toBe('device_durable');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not mint when neither store would hold the value', async () => {
    (isRecoveryStorage as jest.Mock).mockReturnValue(true);
    mockSave.mockResolvedValue(false);

    expect(await loadModule().ensureDeviceId()).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('mints once for concurrent callers', async () => {
    const { ensureDeviceId } = loadModule();

    const [first, second, third] = await Promise.all([
      ensureDeviceId(),
      ensureDeviceId(),
      ensureDeviceId(),
    ]);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('retries after a hydration that resolved nothing', async () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);
    mockSave.mockResolvedValue(false);
    const { ensureDeviceId } = loadModule();
    expect(await ensureDeviceId()).toBeNull();

    (isStorageReady as jest.Mock).mockReturnValue(true);
    mockSave.mockResolvedValue(true);

    expect(await ensureDeviceId()).toEqual(expect.stringMatching(/^device_/));
  });

  it('hands the synchronous readers what it resolved', async () => {
    const { getDeviceId, ensureDeviceId } = loadModule();
    expect(getDeviceId()).toBeNull();

    const id = await ensureDeviceId();

    expect(getDeviceId()).toBe(id);
  });
});

describe('the superseded identifier', () => {
  it('is readable while the row it named still exists', () => {
    __mockStore.set('device_fingerprint', 'android-oldfingerprint');

    expect(loadModule().readLegacyDeviceFingerprint()).toBe(
      'android-oldfingerprint',
    );
  });

  it('reads as absent on a fresh install', () => {
    expect(loadModule().readLegacyDeviceFingerprint()).toBeNull();
  });

  it('reads as absent from a store whose contents are discarded', () => {
    __mockStore.set('device_fingerprint', 'android-oldfingerprint');
    (isRecoveryStorage as jest.Mock).mockReturnValue(true);

    expect(loadModule().readLegacyDeviceFingerprint()).toBeNull();
  });

  it('is removed once the row it named is retired', () => {
    __mockStore.set('device_fingerprint', 'android-oldfingerprint');
    const mod = loadModule();

    mod.clearLegacyDeviceFingerprint();

    expect(mod.readLegacyDeviceFingerprint()).toBeNull();
    expect(__mockStore.has('device_fingerprint')).toBe(false);
  });
});
