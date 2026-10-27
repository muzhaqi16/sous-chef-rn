import { batchedEventRead, type ReadEntries } from '../batchedEventRead';
import type { SubscriptionApolloClient } from '../types';

const client = {} as SubscriptionApolloClient;

const pastTheWindow = async () => {
  await jest.advanceTimersByTimeAsync(150);
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('batchedEventRead', () => {
  // A member's 30-line check-in fires 30 events within milliseconds.
  it('reads what arrives together in one request, answering each caller', async () => {
    const read = jest.fn<ReturnType<ReadEntries>, Parameters<ReadEntries>>(
      async () => ['a', 'c'],
    );
    const readBack = batchedEventRead(read);

    const answers = Promise.all([
      readBack(client, 'a'),
      readBack(client, 'b'),
      readBack(client, 'c'),
      readBack(client, 'a'),
    ]);
    await pastTheWindow();

    expect(await answers).toEqual([true, false, true, true]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(client, ['a', 'b', 'c']);
  });

  it('starts a new request for a read after the window', async () => {
    const read = jest.fn<ReturnType<ReadEntries>, Parameters<ReadEntries>>(
      async (_client, ids) => ids,
    );
    const readBack = batchedEventRead(read);

    const first = readBack(client, 'a');
    await pastTheWindow();
    const second = readBack(client, 'b');
    await pastTheWindow();

    expect([await first, await second]).toEqual([true, true]);
    expect(read.mock.calls.map(([, ids]) => ids)).toEqual([['a'], ['b']]);
  });

  // The API refuses more than 100 ids in one read.
  it('asks at most 100 ids at a time', async () => {
    const read = jest.fn<ReturnType<ReadEntries>, Parameters<ReadEntries>>(
      async (_client, ids) => ids,
    );
    const readBack = batchedEventRead(read);
    const ids = Array.from({ length: 150 }, (_, index) => `id-${index}`);

    const answers = Promise.all(ids.map(id => readBack(client, id)));
    await pastTheWindow();

    expect((await answers).every(Boolean)).toBe(true);
    expect(read.mock.calls.map(([, chunk]) => chunk.length)).toEqual([100, 50]);
  });

  // Offline or a transport failure: nothing came back, nothing to apply.
  it('answers no to every caller when the read fails', async () => {
    const readBack = batchedEventRead(async () => null);
    const failing = batchedEventRead(async () => {
      throw new Error('socket outlived the network');
    });

    const answers = Promise.all([readBack(client, 'a'), failing(client, 'b')]);
    await pastTheWindow();

    expect(await answers).toEqual([false, false]);
  });
});
