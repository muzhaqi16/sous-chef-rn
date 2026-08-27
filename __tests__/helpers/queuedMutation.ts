import { Kind } from 'graphql';
import type { ApolloCache, StoreObject } from '@apollo/client';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';

/**
 * Fixtures for the offline queue's replay path, shared by the kernel's
 * dispatcher test and each feature's sync-builder test.
 */

/** Build a test QueuedMutation. */
export function makeQueuedMutation(
  overrides: Partial<QueuedMutation> = {},
): QueuedMutation {
  return {
    id: `mut-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    operationName: 'TestMutation',
    mutation: { kind: Kind.DOCUMENT, definitions: [] },
    variables: {},
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
    ...overrides,
  };
}

export interface SyncCacheStub extends ApolloCache {
  readFragment: jest.Mock;
  identify: jest.Mock;
}

/**
 * The two cache methods a sync builder calls, keyed exactly as the real cache
 * keys entities. Only these two: a builder's cache access is one
 * `identify` + `readFragment` to backfill a field the queued input omits.
 */
export function makeSyncCacheStub(): SyncCacheStub {
  return {
    readFragment: jest.fn(),
    identify: jest.fn((obj: StoreObject) => `${obj.__typename}:${obj.id}`),
  } as unknown as SyncCacheStub;
}
