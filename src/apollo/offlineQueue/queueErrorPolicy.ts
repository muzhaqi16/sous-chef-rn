import type { QueueError } from './types';

/**
 * Classify a replay error into the queue's policy categories. Pure — the result
 * drives whether the queue retries (`auth` after token refresh; `network` /
 * `server` deferred for the next drain) or fails permanently (`unknown`: client /
 * 4xx / GraphQL validation). Kept separate from the stateful retry orchestration
 * in {@link QueueManager} so the heuristics are testable in isolation.
 */
export function classifyError(error: unknown): QueueError {
  const err = (error ?? {}) as {
    message?: string;
    code?: string;
    extensions?: { code?: string };
    networkError?: { statusCode?: number };
  };
  const message = err.message || String(error);
  const code = err.extensions?.code || err.code;

  // Auth errors
  if (
    code === 'UNAUTHENTICATED' ||
    code === 'FORBIDDEN' ||
    message.toLowerCase().includes('expired') ||
    message.toLowerCase().includes('unauthorized')
  ) {
    return {
      type: 'auth',
      message,
      code,
      timestamp: Date.now(),
      retryable: true, // Can retry after token refresh
    };
  }

  // Network errors
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('econnrefused')
  ) {
    return {
      type: 'network',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // Server errors (5xx)
  if ((err.networkError?.statusCode ?? 0) >= 500) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // Unknown/client errors (4xx, GraphQL errors)
  return {
    type: 'unknown',
    message,
    code,
    timestamp: Date.now(),
    retryable: false, // Don't retry client errors
  };
}

/**
 * Exponential backoff with jitter, capped at 30s. `baseDelayMs` is the queue's
 * configured retry delay; delay = min(baseDelayMs * 2^retryCount + jitter, 30s).
 */
export function calculateRetryDelay(
  retryCount: number,
  baseDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 500; // Add jitter to prevent thundering herd
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
