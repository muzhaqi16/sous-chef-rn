import {
  executeCacheUpdate,
  executeQuery,
  executeMutation,
  executeRefetch,
} from '../compilerSafeWrappers';
import { errorService } from '#/services/errorService';

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

const mockReportError = errorService.reportError as jest.Mock;

beforeEach(() => {
  mockReportError.mockClear();
});

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

  it('logs to console only in __DEV__ when given a string', async () => {
    const err = new Error('oops');
    await executeMutation(() => Promise.reject(err), 'ctx');
    // In test env __DEV__ is true, so console.error should be called
    expect(console.error).toHaveBeenCalledWith('ctx', err);
  });

  it('calls onError callback when given a function', async () => {
    const onError = jest.fn();
    const err = new Error('handled');
    const result = await executeMutation(() => Promise.reject(err), onError);
    expect(result).toBe(false);
    expect(onError).toHaveBeenCalledWith(err);
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
      executeCacheUpdate(() => {
        throw new Error('no refetch');
      }, 'msg'),
    ).not.toThrow();
  });

  it('reports error via errorService on failure', () => {
    const err = new Error('w');
    executeCacheUpdate(() => {
      throw err;
    }, 'cache warn');
    expect(mockReportError).toHaveBeenCalledWith(err, {
      operation: 'cache warn',
    });
  });
});

describe('executeQuery', () => {
  it('returns the resolved value on success', async () => {
    const result = await executeQuery(
      () => Promise.resolve({ data: 1 }),
      'fail',
    );
    expect(result).toEqual({ data: 1 });
  });

  it('returns null on error', async () => {
    const result = await executeQuery(
      () => Promise.reject(new Error('query fail')),
      'query err',
    );
    expect(result).toBeNull();
  });

  it('reports error via errorService on failure', async () => {
    const err = new Error('q');
    await executeQuery(() => Promise.reject(err), 'qmsg');
    expect(mockReportError).toHaveBeenCalledWith(err, { operation: 'qmsg' });
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

  it('reports error via errorService on failure', async () => {
    const err = new Error('r');
    await executeRefetch(() => Promise.reject(err), 'rmsg');
    expect(mockReportError).toHaveBeenCalledWith(err, { operation: 'rmsg' });
  });
});
