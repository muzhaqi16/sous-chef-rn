'use no memo';
import {
  executeRefreshWithFinally,
  executeWriteWithFinally,
  executeAsyncWithCleanup,
} from '../finallyHelpers';

describe('finallyHelpers', () => {
  describe('executeWriteWithFinally', () => {
    // The regression this file exists for: a write that REJECTS used to clear
    // its spinner and report nothing at all, because the shared refresh helper
    // swallows rejections and every mutation call site omitted `onError`. A
    // mutation has no query error state to fall back on, so the user saw the
    // spinner stop and nothing else.
    it('reports a rejection exactly once and still clears the pending flag', async () => {
      const pending: boolean[] = [];
      const onError = jest.fn();
      const boom = new Error('network went away');

      await executeWriteWithFinally(
        () => Promise.reject(boom),
        v => pending.push(v),
        onError,
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(boom);
      expect(pending).toEqual([true, false]);
    });

    it('does not report anything when the write resolves', async () => {
      const pending: boolean[] = [];
      const onError = jest.fn();

      await executeWriteWithFinally(
        () => Promise.resolve({ success: true }),
        v => pending.push(v),
        onError,
      );

      expect(onError).not.toHaveBeenCalled();
      expect(pending).toEqual([true, false]);
    });

    it('never rejects, so a call site does not need its own catch', async () => {
      await expect(
        executeWriteWithFinally(
          () => Promise.reject(new Error('boom')),
          () => {},
          () => {},
        ),
      ).resolves.toBeUndefined();
    });

    it('clears the pending flag even when the handler itself throws', async () => {
      const pending: boolean[] = [];

      await expect(
        executeWriteWithFinally(
          () => Promise.reject(new Error('boom')),
          v => pending.push(v),
          () => {
            throw new Error('handler blew up');
          },
        ),
      ).rejects.toThrow('handler blew up');

      // `finally` runs on the way out, so the spinner does not survive a
      // handler bug — the failure mode this helper exists to prevent.
      expect(pending).toEqual([true, false]);
    });
  });

  describe('executeRefreshWithFinally', () => {
    // Deliberately unchanged: a refetch's failure is already on the query's own
    // error state, so swallowing here avoids a second message rather than
    // losing the only one.
    it('swallows a rejection when no handler is given, and clears the flag', async () => {
      const refreshing: boolean[] = [];

      await expect(
        executeRefreshWithFinally(
          () => Promise.reject(new Error('refetch failed')),
          v => refreshing.push(v),
        ),
      ).resolves.toBeUndefined();

      expect(refreshing).toEqual([true, false]);
    });

    it('forwards to a handler when one is given', async () => {
      const onError = jest.fn();
      const boom = new Error('refetch failed');

      await executeRefreshWithFinally(
        () => Promise.reject(boom),
        () => {},
        onError,
      );

      expect(onError).toHaveBeenCalledWith(boom);
    });
  });

  describe('executeAsyncWithCleanup', () => {
    it('runs cleanup on both paths', async () => {
      const cleanup = jest.fn();

      await executeAsyncWithCleanup(() => Promise.resolve(), cleanup);
      await executeAsyncWithCleanup(
        () => Promise.reject(new Error('x')),
        cleanup,
      );

      expect(cleanup).toHaveBeenCalledTimes(2);
    });
  });
});
