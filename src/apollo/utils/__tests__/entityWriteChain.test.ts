import { InMemoryCache, gql } from '@apollo/client';
import {
  UnreadVersionError,
  chainEntityWrite,
  chainVersionedWrite,
} from '../entityWriteChain';

const PlanVersion = gql`
  fragment EntityWriteChainVersion on MealPlan {
    id
    version
  }
`;

const plan = { __typename: 'MealPlan', id: 'plan-1' };

const cacheAt = (version: number) => {
  const cache = new InMemoryCache();
  writeVersion(cache, version);
  return cache;
};

const writeVersion = (cache: InMemoryCache, version: number) =>
  cache.writeFragment({
    fragment: PlanVersion,
    data: { ...plan, version },
  });

const deferred = () => {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe('chainEntityWrite', () => {
  it('sends a second write once the first settles, at the version its answer wrote', async () => {
    const cache = cacheAt(3);
    const sent: Array<number | undefined> = [];
    const answer = deferred();

    const first = chainEntityWrite(cache, plan, async version => {
      sent.push(version);
      await answer.promise;
      writeVersion(cache, 4);
      return 'first';
    });
    const second = chainEntityWrite(cache, plan, version => {
      sent.push(version);
      return Promise.resolve('second');
    });
    await Promise.resolve();
    expect(sent).toEqual([3]);

    answer.resolve();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(sent).toEqual([3, 4]);
  });

  it('sends the next write after one that failed', async () => {
    const cache = cacheAt(3);
    const answer = deferred();

    const first = chainEntityWrite(cache, plan, () => answer.promise);
    const second = chainEntityWrite(cache, plan, version =>
      Promise.resolve(version),
    );
    answer.reject(new Error('offline'));

    await expect(first).rejects.toThrow('offline');
    await expect(second).resolves.toBe(3);
  });

  it('holds no write to another entity', async () => {
    const cache = cacheAt(3);
    const sent: string[] = [];

    void chainEntityWrite(cache, plan, () => {
      sent.push('plan-1');
      return new Promise(() => {});
    });
    void chainEntityWrite(cache, { ...plan, id: 'plan-2' }, version => {
      sent.push(`plan-2@${String(version)}`);
      return Promise.resolve();
    });

    expect(sent).toEqual(['plan-1', 'plan-2@undefined']);
  });
});

describe('chainVersionedWrite', () => {
  const PlanName = gql`
    fragment EntityWriteChainName on MealPlan {
      id
      name
    }
  `;

  it('sends the version the cache holds', async () => {
    const cache = cacheAt(3);
    const send = jest.fn((version: number) =>
      Promise.resolve(`sent at ${String(version)}`),
    );

    await expect(chainVersionedWrite(cache, plan, send)).resolves.toBe(
      'sent at 3',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(3);
  });

  it('sends a second write at the version the first one left in the cache', async () => {
    const cache = cacheAt(3);
    const sent: number[] = [];
    const answer = deferred();

    const first = chainVersionedWrite(cache, plan, async version => {
      sent.push(version);
      await answer.promise;
      writeVersion(cache, 4);
    });
    const second = chainVersionedWrite(cache, plan, version => {
      sent.push(version);
      return Promise.resolve();
    });
    await Promise.resolve();
    expect(sent).toEqual([3]);

    answer.resolve();
    await first;
    await second;
    expect(sent).toEqual([3, 4]);
  });

  it('rejects with UnreadVersionError and never sends for a row the cache does not hold', async () => {
    const send = jest.fn(() => Promise.resolve('sent'));

    const write = chainVersionedWrite(new InMemoryCache(), plan, send);

    await expect(write).rejects.toBeInstanceOf(UnreadVersionError);
    await expect(write).rejects.toMatchObject({
      name: 'UnreadVersionError',
      message: expect.stringContaining('MealPlan'),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects and never sends for a row cached without its version', async () => {
    const cache = new InMemoryCache();
    cache.writeFragment({
      fragment: PlanName,
      data: { ...plan, name: 'Week 1' },
    });
    const send = jest.fn(() => Promise.resolve('sent'));

    await expect(chainVersionedWrite(cache, plan, send)).rejects.toBeInstanceOf(
      UnreadVersionError,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects and never sends for a row whose cached version is null', async () => {
    const cache = new InMemoryCache();
    cache.writeFragment({
      fragment: PlanVersion,
      data: { ...plan, version: null },
    });
    const send = jest.fn(() => Promise.resolve('sent'));

    await expect(chainVersionedWrite(cache, plan, send)).rejects.toBeInstanceOf(
      UnreadVersionError,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the next write once the version is read, after one it refused', async () => {
    const cache = new InMemoryCache();
    const send = jest.fn((version: number) => Promise.resolve(version));

    const unread = chainVersionedWrite(cache, plan, send);
    writeVersion(cache, 7);
    const read = chainVersionedWrite(cache, plan, send);

    await expect(unread).rejects.toBeInstanceOf(UnreadVersionError);
    await expect(read).resolves.toBe(7);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
