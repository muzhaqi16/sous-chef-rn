import { isStorageReady, storage } from '#/storage/mmkv';

jest.mock('#/storage/mmkv');

const { __mockStore } = jest.requireMock<{
  __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
}>('#/storage/mmkv');

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
});

describe('getDeviceId', () => {
  it('returns null before storage opens', () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);

    expect(loadModule().getDeviceId()).toBeNull();
  });

  it('writes nothing while storage is closed', () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);

    loadModule().getDeviceId();

    expect(storage.set).not.toHaveBeenCalled();
    expect(__mockStore.size).toBe(0);
  });

  it('persists the id it mints', () => {
    const id = loadModule().getDeviceId();

    expect(id).toEqual(expect.stringMatching(/^device_/));
    expect(__mockStore.get('device_id')).toBe(id);
  });

  it('returns the same value on repeated calls', () => {
    const { getDeviceId } = loadModule();

    expect(getDeviceId()).toBe(getDeviceId());
    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  it('reads back a value an earlier launch stored', () => {
    __mockStore.set('device_id', 'device_stored');

    expect(loadModule().getDeviceId()).toBe('device_stored');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('never returns a value it did not write to storage', () => {
    const { getDeviceId } = loadModule();
    (isStorageReady as jest.Mock).mockReturnValue(false);

    expect(getDeviceId()).toBeNull();

    (isStorageReady as jest.Mock).mockReturnValue(true);
    const minted = getDeviceId();
    expect(__mockStore.get('device_id')).toBe(minted);
  });

  it('is at most 128 characters, past which the server reads it as absent', () => {
    expect(loadModule().getDeviceId()!.length).toBeLessThanOrEqual(128);
  });
});

describe('initializeDeviceId', () => {
  it('drops a memoized null once storage has opened', () => {
    const { getDeviceId, initializeDeviceId } = loadModule();
    (isStorageReady as jest.Mock).mockReturnValue(false);
    expect(getDeviceId()).toBeNull();

    (isStorageReady as jest.Mock).mockReturnValue(true);
    const id = initializeDeviceId();

    expect(id).toEqual(expect.stringMatching(/^device_/));
    expect(getDeviceId()).toBe(id);
  });

  it('keeps the stored id rather than minting a second one', () => {
    __mockStore.set('device_id', 'device_stored');
    const { initializeDeviceId } = loadModule();

    expect(initializeDeviceId()).toBe('device_stored');
    expect(initializeDeviceId()).toBe('device_stored');
    expect(storage.set).not.toHaveBeenCalled();
  });
});
