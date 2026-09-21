import {
  getGenericPassword,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import {
  addPendingRevocation,
  loadPendingRevocations,
  PENDING_REVOCATIONS_SERVICE,
  removePendingRevocation,
} from '../keychain';

// A keychain backed by one slot, so each call reads what the previous wrote.
let slot: string | null = null;

beforeEach(() => {
  slot = null;
  (getGenericPassword as jest.Mock).mockImplementation(() =>
    Promise.resolve(slot === null ? false : { password: slot }),
  );
  (setGenericPassword as jest.Mock).mockImplementation(
    (_user: string, password: string) => {
      slot = password;
      return Promise.resolve(true);
    },
  );
  (resetGenericPassword as jest.Mock).mockImplementation(() => {
    slot = null;
    return Promise.resolve(true);
  });
});

const entry = (n: number) => ({ refreshToken: `r-${n}`, accessToken: null });

describe('pending revocations', () => {
  it('keeps what it parks until it is removed', async () => {
    await addPendingRevocation(entry(1));
    await addPendingRevocation({ refreshToken: 'r-2', accessToken: 'a-2' });
    await removePendingRevocation('r-1');

    expect(await loadPendingRevocations()).toEqual([
      { refreshToken: 'r-2', accessToken: 'a-2' },
    ]);
    expect(setGenericPassword).toHaveBeenCalledWith(
      'revocations',
      expect.any(String),
      expect.objectContaining({ service: PENDING_REVOCATIONS_SERVICE }),
    );
  });

  it('parks a token once however often it is added', async () => {
    await addPendingRevocation(entry(1));
    await addPendingRevocation(entry(1));

    expect(await loadPendingRevocations()).toEqual([entry(1)]);
  });

  it('drops the oldest past its bound', async () => {
    for (let n = 1; n <= 12; n++) await addPendingRevocation(entry(n));

    const pending = await loadPendingRevocations();
    expect(pending).toHaveLength(10);
    expect(pending[0]).toEqual(entry(3));
  });

  it('empties the slot when the last one settles', async () => {
    await addPendingRevocation(entry(1));
    await removePendingRevocation('r-1');

    expect(resetGenericPassword).toHaveBeenCalledWith({
      service: PENDING_REVOCATIONS_SERVICE,
    });
    expect(slot).toBeNull();
  });

  it('reads a corrupted slot as empty', async () => {
    slot = '{not json';

    expect(await loadPendingRevocations()).toEqual([]);
  });

  it('reports a park the keychain refused', async () => {
    (setGenericPassword as jest.Mock).mockRejectedValueOnce(
      new Error('locked'),
    );

    await expect(addPendingRevocation(entry(1))).resolves.toBe(false);
  });

  it('reports a park the keychain declined without throwing', async () => {
    (setGenericPassword as jest.Mock).mockResolvedValueOnce(false);

    await expect(addPendingRevocation(entry(1))).resolves.toBe(false);
  });
});
