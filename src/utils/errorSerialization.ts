/**
 * Safely serializes any Apollo / Network / JS error into a JSON-friendly object
 * without ever throwing or getting caught in circular references.
 *
 * Uses WeakSet to track visited objects and prevent circular references.
 * Limits recursion depth to avoid serializing massive Apollo context objects.
 */
/**
 * Type guard narrowing an opaque value to an indexable object so optional
 * error properties can be read without `any`.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract a string message from an opaque error value (string, Error, or any
 * object carrying a string `message`), returning '' when none is present.
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return '';
}

/** One normalized Apollo GraphQL error entry within {@link SerializedError}. */
interface SerializedGraphQLError {
  message: string;
  path: unknown;
  extensions: unknown;
}

/** Normalized Apollo network-error shape within {@link SerializedError}. */
interface SerializedNetworkError {
  name: string;
  message: string;
  statusCode: unknown;
  result: unknown;
}

/** Normalized Apollo operation context within {@link SerializedError}. */
interface SerializedOperation {
  operationName: string;
  variables: unknown;
}

/**
 * JSON-friendly, fully-narrowed error shape returned by {@link serializeError}.
 *
 * The well-known Apollo/JS error fields are typed so readers index them
 * (`result.graphQLErrors?.[0].message`, `result.networkError?.name`) without
 * casts. The index signature keeps the object open for the dynamic
 * `additionalProperties` capture and any logger that reads ad-hoc keys.
 */
export interface SerializedError {
  name?: string;
  message: string;
  code?: unknown;
  stack?: string;
  graphQLErrors?: SerializedGraphQLError[];
  networkError?: SerializedNetworkError;
  operation?: SerializedOperation;
  extraInfo?: unknown;
  additionalProperties?: Record<string, unknown> | string;
  [key: string]: unknown;
}

export function serializeError(error: unknown, maxDepth = 4): SerializedError {
  if (!error) return { message: 'Unknown error' };
  if (typeof error === 'string') return { message: error };
  if (!isRecord(error)) return { message: String(error) };

  const visited = new WeakSet<object>();

  /**
   * Recursively serialize a value while tracking visited objects
   * to avoid circular references and limiting depth.
   */
  function safeSerialize(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) return value;

    // Limit depth to avoid massive structures (like Apollo operation context)
    if (depth > maxDepth) {
      return '[Max depth reached]';
    }

    // Handle primitives
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString();

    // Avoid circular references
    if (visited.has(value)) return '[Circular]';
    visited.add(value);

    // Arrays
    if (Array.isArray(value)) {
      return value.map(item => safeSerialize(item, depth + 1));
    }

    // Objects
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(record)) {
      try {
        output[key] = safeSerialize(record[key], depth + 1);
      } catch {
        output[key] = '[Unserializable]';
      }
    }

    return output;
  }

  // Build the serialized error object
  const serialized: SerializedError = {
    name: typeof error.name === 'string' && error.name ? error.name : 'Error',
    message:
      typeof error.message === 'string' && error.message
        ? error.message
        : 'Unknown error',
  };

  // Add error code if present (common in GraphQL errors)
  if (error.code) {
    serialized.code = error.code;
  }

  // Add stack trace if it's a string
  if (typeof error.stack === 'string') {
    serialized.stack = error.stack;
  }

  // ---- Apollo GraphQL Errors ----
  if (Array.isArray(error.graphQLErrors)) {
    serialized.graphQLErrors = error.graphQLErrors.map((entry: unknown) => {
      const gqlErr = isRecord(entry) ? entry : {};
      return {
        message:
          typeof gqlErr.message === 'string'
            ? gqlErr.message
            : String(gqlErr.message || ''),
        path: Array.isArray(gqlErr.path)
          ? gqlErr.path.map((p: unknown) =>
              typeof p === 'string' || typeof p === 'number' ? p : String(p),
            )
          : safeSerialize(gqlErr.path, 1),
        extensions: safeSerialize(gqlErr.extensions, 1),
      };
    });
  }

  // ---- Apollo Network Error ----
  if (isRecord(error.networkError)) {
    const networkError = error.networkError;
    serialized.networkError = {
      name:
        typeof networkError.name === 'string'
          ? networkError.name
          : String(networkError.name || 'NetworkError'),
      message:
        typeof networkError.message === 'string'
          ? networkError.message
          : String(networkError.message || ''),
      statusCode: networkError.statusCode,
      result: safeSerialize(networkError.result, 1),
    };
  }

  // ---- Apollo Error Operation ----
  if (isRecord(error.operation)) {
    const operation = error.operation;
    serialized.operation = {
      operationName:
        typeof operation.operationName === 'string'
          ? operation.operationName
          : String(operation.operationName || ''),
      variables: safeSerialize(operation.variables, 1),
    };
  }

  // ---- Extra Info ----
  if (error.extraInfo) {
    serialized.extraInfo = safeSerialize(error.extraInfo, 1);
  }

  // ---- Fallback: capture any other properties on the error object ----
  // Only include in development to avoid bloating production logs
  if (__DEV__) {
    try {
      const knownProps = new Set([
        'name',
        'message',
        'code',
        'stack',
        'graphQLErrors',
        'networkError',
        'operation',
        'extraInfo',
      ]);

      const unknownProps: Record<string, unknown> = {};
      for (const key of Object.keys(error)) {
        if (!knownProps.has(key)) {
          unknownProps[key] = safeSerialize(error[key], 1);
        }
      }

      if (Object.keys(unknownProps).length > 0) {
        serialized.additionalProperties = unknownProps;
      }
    } catch {
      serialized.additionalProperties =
        '[Error serializing additional properties]';
    }
  }

  return serialized;
}

/**
 * Check if an error message indicates a circular structure issue
 * These errors are expected during WebSocket reconnection and can be safely downgraded to warnings
 */
export function isCircularStructureError(error: unknown): boolean {
  if (!error) return false;

  const message = getErrorMessage(error);

  return (
    message.includes('Converting circular structure to JSON') ||
    message.includes('circular structure')
  );
}

/**
 * Check if an error is a timer-related circular structure error
 * These are expected during subscription teardown/setup due to graphql-ws internals
 * and are not actionable - they should be silently suppressed
 *
 * The graphql-ws library uses internal setTimeout for keepalive pings.
 * During subscription lifecycle transitions, error events may contain
 * Timer object references which have circular linked-list structures.
 */
export function isTimerCircularStructureError(error: unknown): boolean {
  if (!error) return false;

  const message = getErrorMessage(error);

  // Must be a circular structure error AND involve timer objects
  return (
    message.includes('Converting circular structure to JSON') &&
    (message.includes('Timeout') ||
      message.includes('TimersList') ||
      message.includes('_idlePrev') ||
      message.includes('_idleNext'))
  );
}

/**
 * Safely stringify errors with circular structure detection
 * Returns a brief warning message for circular structure errors instead of throwing
 */
export function safeStringifyError(error: unknown): {
  stringified: string;
  isCircular: boolean;
  message: string;
} {
  // Short-circuit when the error message already indicates a circular structure
  const hasCircularMessage =
    isCircularStructureError(error) ||
    (Array.isArray(error) &&
      error.some(item => isCircularStructureError(item)));

  if (hasCircularMessage) {
    const message = (() => {
      if (Array.isArray(error)) {
        const circularError = error.find(item =>
          isCircularStructureError(item),
        );
        if (typeof circularError === 'string') {
          return circularError;
        }
        if (circularError instanceof Error) {
          return circularError.message;
        }
      } else if (typeof error === 'string') {
        return error;
      } else if (error instanceof Error) {
        return error.message;
      }
      return 'Unknown error';
    })();

    return {
      stringified: `[Circular structure detected] ${message}`,
      isCircular: true,
      message,
    };
  }

  try {
    const stringified =
      typeof error === 'string' ? error : JSON.stringify(error, null, 2);
    return {
      stringified,
      isCircular: false,
      message: '',
    };
  } catch (stringifyError: unknown) {
    const stringifyMessage =
      stringifyError instanceof Error ? stringifyError.message : '';
    const isCircular =
      stringifyMessage.includes('Converting circular structure to JSON') ||
      stringifyMessage.includes('circular');

    if (isCircular) {
      // Extract error message if available
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        stringified: `[Circular structure detected] ${errorMessage}`,
        isCircular: true,
        message: errorMessage,
      };
    }

    // Some other JSON.stringify error
    return {
      stringified: `[Error serializing: ${stringifyMessage}]`,
      isCircular: false,
      message: stringifyMessage,
    };
  }
}
