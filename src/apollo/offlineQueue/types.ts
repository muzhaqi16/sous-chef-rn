import { DocumentNode } from 'graphql';
import type { DefaultContext, OperationVariables } from '@apollo/client';

export enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  FAILED = 'failed',
  AUTH_ERROR = 'auth_error',
  SUCCESS = 'success', // Kept briefly after replay, for reconciliation.
}

/**
 * The queue is at capacity with nothing terminal to evict — full of un-synced
 * work. Refusing the enqueue is deliberate: dropping the oldest PENDING op
 * instead would break create→update dependency chains.
 */
export class QueueCapacityError extends Error {
  constructor(
    message = 'Too many unsynced changes. Reconnect to sync before making more changes.',
  ) {
    super(message);
    this.name = 'QueueCapacityError';
  }
}

export interface QueueError {
  type: 'network' | 'auth' | 'server' | 'unknown';
  message: string;
  code?: string;
  timestamp: number;
  retryable: boolean;
}

export interface QueuedMutation {
  id: string; // UUID of the queue entry itself, not of any entity.
  userId: string; // Scopes replay; a queue is never drained for another user.
  operationName: string;

  mutation: DocumentNode;
  variables: OperationVariables;
  context?: DefaultContext; // Allowlisted replay context (localFirst only).

  status: QueueStatus;
  createdAt: number;
  updatedAt: number;
  processedAt?: number;

  retryCount: number;
  maxRetries: number;
  lastError?: QueueError;

  requiresAuth: boolean;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  authErrors: number;
  oldestMutationAge?: number; // Age of oldest pending mutation in ms
}

/** Queue size is bounded in queueStore; max retries ride on each mutation. */
export interface QueueConfig {
  retryDelayMs: number; // Base for the exponential backoff.
  processingTimeoutMs: number;
}

export interface ProcessingResult {
  success: boolean;
  mutationId: string;
  error?: QueueError;
  serverResponse?: Record<string, unknown>;
  // A transient error returned the mutation to PENDING: the drain loop must
  // stop rather than replay later mutations ahead of this un-synced one.
  deferred?: boolean;
}

export interface FailedMutationInfo {
  mutationId: string;
  operationName: string;
  entityType: string | null;
  entityId: string | null;
  /**
   * The refused write's own variables. The generic evict of
   * `entityType`/`entityId` covers a create; an operation that also UNLINKED
   * something needs its own withdrawal, which needs to know which row.
   */
  variables: OperationVariables;
  error: QueueError;
}

export type FailureHandler = (info: FailedMutationInfo) => void;
