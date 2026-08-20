'use no memo';

import {
  registerSessionTeardown,
  runSessionTeardown,
  clearSessionTeardown,
} from '../sessionTeardown';
import { logger } from '#/utils/environment';

describe('sessionTeardown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSessionTeardown();
  });

  afterEach(() => {
    clearSessionTeardown();
  });

  it('runs every registered step', async () => {
    const apollo = jest.fn();
    const queue = jest.fn();
    registerSessionTeardown('apollo', apollo);
    registerSessionTeardown('offline-queue', queue);

    await runSessionTeardown();

    expect(apollo).toHaveBeenCalledTimes(1);
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('awaits an async step before moving on', async () => {
    const order: string[] = [];
    registerSessionTeardown('slow', async () => {
      await Promise.resolve();
      order.push('slow');
    });
    registerSessionTeardown('fast', () => {
      order.push('fast');
    });

    await runSessionTeardown();

    expect(order).toEqual(['slow', 'fast']);
  });

  it('runs the remaining steps when one throws', async () => {
    // The steps are independent, and a session that ends half-quiet is exactly
    // the failure this registry exists to prevent.
    const queue = jest.fn();
    registerSessionTeardown('apollo', () => {
      throw new Error('dispose failed');
    });
    registerSessionTeardown('offline-queue', queue);

    await expect(runSessionTeardown()).resolves.toBeUndefined();

    expect(queue).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Session teardown step "apollo" failed:',
      expect.any(Error),
    );
  });

  it('runs the remaining steps when one rejects', async () => {
    const queue = jest.fn();
    registerSessionTeardown('apollo', () => Promise.reject(new Error('nope')));
    registerSessionTeardown('offline-queue', queue);

    await expect(runSessionTeardown()).resolves.toBeUndefined();

    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('replaces a step registered twice under the same name', async () => {
    // Module init can run more than once under Fast Refresh; registering must
    // not stack duplicate teardowns.
    const first = jest.fn();
    const second = jest.fn();
    registerSessionTeardown('apollo', first);
    registerSessionTeardown('apollo', second);

    await runSessionTeardown();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing has registered', async () => {
    await expect(runSessionTeardown()).resolves.toBeUndefined();
  });
});
