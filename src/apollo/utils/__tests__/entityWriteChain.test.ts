import { InMemoryCache, gql } from '@apollo/client';
import { chainEntityWrite } from '../entityWriteChain';

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
