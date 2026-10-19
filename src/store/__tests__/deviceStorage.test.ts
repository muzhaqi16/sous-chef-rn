import { storage, zustandStorage } from '../deviceStorage';

describe('zustandStorage', () => {
  it('setItem stores a value', async () => {
    await zustandStorage.setItem('zustand-key', 'zustand-value');
    const value = await zustandStorage.getItem('zustand-key');
    expect(value).toBe('zustand-value');
  });

  it('getItem returns null for non-existent keys', async () => {
    const value = await zustandStorage.getItem('nonexistent-zustand');
    expect(value).toBeNull();
  });

  it('removeItem removes a value', async () => {
    await zustandStorage.setItem('to-remove', 'value');
    await zustandStorage.removeItem('to-remove');
    const value = await zustandStorage.getItem('to-remove');
    expect(value).toBeNull();
  });

  it('waits for device storage to open before every call', async () => {
    const ready = jest.spyOn(storage, 'ready');

    await zustandStorage.getItem('any-key');
    await zustandStorage.setItem('any-key', 'value');
    await zustandStorage.removeItem('any-key');

    expect(ready).toHaveBeenCalledTimes(3);
    ready.mockRestore();
  });
});
