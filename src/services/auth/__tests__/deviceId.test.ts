import { storage } from '#/store/deviceStorage';
import { requirePlatform } from '#platform/install';

const storageReady = jest.spyOn(storage, 'isReady');
const recoveryMode = jest.spyOn(storage, 'isRecovery');
const storageSet = jest.spyOn(storage, 'set');

/** What device storage holds, seeded without counting as the code's write. */
const disk = {
  seed: (key: string, value: string) => {
    storage.set(key, value);
    storageSet.mockClear();
  },
  get: (key: string) => storage.getString(key),
  has: (key: string) => storage.contains(key),
  size: () => storage.getAllKeys().length,
};

const secureStore = requirePlatform('secureStore');
const mockLoad = jest.spyOn(secureStore, 'loadDeviceId');
const mockSave = jest.spyOn(secureStore, 'saveDeviceId');

// The module memoizes, so each case re-imports it to start from a cold cache.
const loadModule = () => {
  let mod!: typeof import('#/services/auth/deviceId');
  jest.isolateModules(() => {
    mod = require('#/services/auth/deviceId');
  });
  return mod;
};

beforeEach(() => {
  storage.clearAll();
  jest.clearAllMocks();
  storageReady.mockReturnValue(true);
  recoveryMode.mockReturnValue(false);
  mockLoad.mockResolvedValue({ status: 'absent' });
  mockSave.mockResolvedValue(true);
});

describe('getDeviceId', () => {
  it('returns null before storage opens', () => {
    storageReady.mockReturnValue(false);

    expect(loadModule().getDeviceId()).toBeNull();
  });

  it('mints nothing, so a cold cache reads as absent rather than as a new device', () => {
    expect(loadModule().getDeviceId()).toBeNull();
    expect(storageSet).not.toHaveBeenCalled();
    expect(disk.size()).toBe(0);
  });

  it('reads back a value an earlier launch stored', () => {
    disk.seed('device_id', 'device_stored');

    expect(loadModule().getDeviceId()).toBe('device_stored');
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('memoizes, so the header path pays one storage read per launch', () => {
    disk.seed('device_id', 'device_stored');
    const { getDeviceId } = loadModule();
    const read = jest.spyOn(storage, 'getString');

    expect(getDeviceId()).toBe(getDeviceId());
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRestore();
  });

  // The recovery instance opens unencrypted when the device key is unavailable
  // and is erased on the next healthy launch, so a value read or written there
  // belongs to no install.
  it('reports absent on the recovery instance rather than reading it', () => {
    disk.seed('device_id', 'device_from_a_discarded_file');
    recoveryMode.mockReturnValue(true);

    expect(loadModule().getDeviceId()).toBeNull();
  });

  it('writes nothing to the recovery instance', () => {
    recoveryMode.mockReturnValue(true);

    loadModule().getDeviceId();

    expect(storageSet).not.toHaveBeenCalled();
    expect(disk.size()).toBe(0);
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
    expect(disk.get('device_id')).toBe(id);
    expect(mockSave).toHaveBeenCalledWith(id);
  });

  it('reaches durable storage before it reaches the mirror', async () => {
    let mirroredAtSaveTime: boolean | null = null;
    mockSave.mockImplementation(async () => {
      mirroredAtSaveTime = disk.has('device_id');
      return true;
    });

    const id = await loadModule().ensureDeviceId();

    expect(mirroredAtSaveTime).toBe(false);
    expect(disk.get('device_id')).toBe(id);
  });

  it('restores the identifier the keychain holds when the mirror is empty', async () => {
    mockLoad.mockResolvedValue({ status: 'ok', deviceId: 'device_durable' });

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_durable');
    expect(disk.get('device_id')).toBe('device_durable');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('writes an install that predates the keychain copy through to it', async () => {
    disk.seed('device_id', 'device_stored');

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_stored');
    expect(mockSave).toHaveBeenCalledWith('device_stored');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('serves the durable identifier during a storage outage without mirroring it', async () => {
    recoveryMode.mockReturnValue(true);
    mockLoad.mockResolvedValue({ status: 'ok', deviceId: 'device_durable' });

    const id = await loadModule().ensureDeviceId();

    expect(id).toBe('device_durable');
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('does not mint when the durable read fails', async () => {
    mockLoad.mockResolvedValue({ status: 'error' });

    expect(await loadModule().ensureDeviceId()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
    expect(disk.size()).toBe(0);
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
    recoveryMode.mockReturnValue(true);
    mockSave.mockResolvedValue(false);

    expect(await loadModule().ensureDeviceId()).toBeNull();
    expect(storageSet).not.toHaveBeenCalled();
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
    storageReady.mockReturnValue(false);
    mockSave.mockResolvedValue(false);
    const { ensureDeviceId } = loadModule();
    expect(await ensureDeviceId()).toBeNull();

    storageReady.mockReturnValue(true);
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

describe('the registered locale', () => {
  it('is new when none is on record, and recorded', () => {
    const mod = loadModule();

    expect(mod.recordRegisteredLocale('en-US')).toBe(true);
    expect(mod.recordRegisteredLocale('en-US')).toBe(false);
  });

  it('is new when the device locale changed since the last registration', () => {
    const mod = loadModule();
    mod.recordRegisteredLocale('en-US');

    expect(mod.recordRegisteredLocale('de-DE')).toBe(true);
  });

  it('records a locale the device could not read, so it is not new twice', () => {
    const mod = loadModule();

    expect(mod.recordRegisteredLocale(null)).toBe(true);
    expect(mod.recordRegisteredLocale(null)).toBe(false);
  });

  it('is new again once a session end forgets it', () => {
    const mod = loadModule();
    mod.recordRegisteredLocale('en-US');

    mod.clearRegisteredLocale();

    expect(mod.recordRegisteredLocale('en-US')).toBe(true);
  });

  it('is always new where nothing survives to compare with', () => {
    recoveryMode.mockReturnValue(true);
    const mod = loadModule();

    expect(mod.recordRegisteredLocale('en-US')).toBe(true);
    expect(mod.recordRegisteredLocale('en-US')).toBe(true);
  });
});
