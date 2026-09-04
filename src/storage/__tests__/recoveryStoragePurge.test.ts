import { createMMKV, existsMMKV } from 'react-native-mmkv';
import { purgeRecoveryStorage } from '#/storage/mmkv';

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
