import {
  executeMutation,
  executeCacheUpdate,
  executeQuery,
  executeMutationWithErrorHandler,
  executeRefetch,
} from '../compilerSafeWrappers';

describe('executeMutation', () => {
  it('returns the resolved value on success', async () => {
    const result = await executeMutation(() => Promise.resolve(42), 'fail');
    expect(result).toBe(42);
  });

  it('returns false on error', async () => {
    const result = await executeMutation(
      () => Promise.reject(new Error('boom')),
      'mutation failed',
    );
    expect(result).toBe(false);
  });

  it('logs an error message on failure', async () => {
    const err = new Error('oops');
    await executeMutation(() => Promise.reject(err), 'ctx');
    expect(console.error).toHaveBeenCalledWith('ctx', err);
  });
});

describe('executeCacheUpdate', () => {
  it('calls the update function', () => {
    const fn = jest.fn();
    executeCacheUpdate(fn, 'err');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls refetch when the update throws', () => {
    const refetch = jest.fn();
    executeCacheUpdate(
      () => {
        throw new Error('cache');
      },
      'cache err',
      refetch,
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw when refetch is omitted and update throws', () => {
    expect(() =>
      executeCacheUpdate(
        () => {
          throw new Error('no refetch');
        },
        'msg',
      ),
    ).not.toThrow();
  });

  it('logs a warning on failure', () => {
    const err = new Error('w');
    executeCacheUpdate(
      () => {
        throw err;
      },
      'cache warn',
    );
    expect(console.warn).toHaveBeenCalledWith('cache warn', err);
  });
});

describe('executeQuery', () => {
  it('returns the resolved value on success', async () => {
    const result = await executeQuery(() => Promise.resolve({ data: 1 }), 'fail');
    expect(result).toEqual({ data: 1 });
  });

  it('returns null on error', async () => {
    const result = await executeQuery(
      () => Promise.reject(new Error('query fail')),
      'query err',
    );
    expect(result).toBeNull();
  });

  it('logs an error message on failure', async () => {
    await executeQuery(() => Promise.reject(new Error('q')), 'qmsg');
    expect(console.error).toHaveBeenCalledWith('qmsg', expect.any(Error));
  });
});

describe('executeMutationWithErrorHandler', () => {
  it('returns the resolved value on success', async () => {
    const result = await executeMutationWithErrorHandler(
      () => Promise.resolve('ok'),
      jest.fn(),
    );
    expect(result).toBe('ok');
  });

  it('calls onError and returns false on failure', async () => {
    const onError = jest.fn();
    const err = new Error('handled');
    const result = await executeMutationWithErrorHandler(
      () => Promise.reject(err),
      onError,
    );
    expect(result).toBe(false);
    expect(onError).toHaveBeenCalledWith(err);
  });
});

describe('executeRefetch', () => {
  it('resolves without error on success', async () => {
    await expect(
      executeRefetch(() => Promise.resolve(undefined), 'msg'),
    ).resolves.toBeUndefined();
  });

  it('does not throw on failure', async () => {
    await expect(
      executeRefetch(() => Promise.reject(new Error('r')), 'refetch err'),
    ).resolves.toBeUndefined();
  });

  it('logs a warning on failure', async () => {
    await executeRefetch(() => Promise.reject(new Error('r')), 'rmsg');
    expect(console.warn).toHaveBeenCalledWith('rmsg', expect.any(Error));
  });
});
