/**
 * Safely serializes any Apollo / Network / JS error into a JSON-friendly object
 * without ever throwing or getting caught in circular references.
 *
 * Uses WeakSet to track visited objects and prevent circular references.
 * Limits recursion depth to avoid serializing massive Apollo context objects.
 */
export function serializeError(error: any, maxDepth = 4): Record<string, any> {
  if (!error) return { message: 'Unknown error' };
  if (typeof error === 'string') return { message: error };

  const visited = new WeakSet();

  /**
   * Recursively serialize a value while tracking visited objects
   * to avoid circular references and limiting depth.
   */
  function safeSerialize(value: any, depth: number): any {
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
    const output: Record<string, any> = {};

    for (const key of Object.keys(value)) {
      try {
        output[key] = safeSerialize(value[key], depth + 1);
      } catch {
        output[key] = '[Unserializable]';
      }
    }

    return output;
  }

  // Build the serialized error object
  const serialized: Record<string, any> = {
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
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
    serialized.graphQLErrors = error.graphQLErrors.map((gqlErr: any) => ({
      message:
        typeof gqlErr.message === 'string'
          ? gqlErr.message
          : String(gqlErr.message || ''),
      path: Array.isArray(gqlErr.path)
        ? gqlErr.path.map((p: any) =>
            typeof p === 'string' || typeof p === 'number' ? p : String(p),
          )
        : safeSerialize(gqlErr.path, 1),
      extensions: safeSerialize(gqlErr.extensions, 1),
    }));
  }

  // ---- Apollo Network Error ----
  if (error.networkError) {
    serialized.networkError = {
      name:
        typeof error.networkError.name === 'string'
          ? error.networkError.name
          : String(error.networkError.name || 'NetworkError'),
      message:
        typeof error.networkError.message === 'string'
          ? error.networkError.message
          : String(error.networkError.message || ''),
      statusCode: error.networkError.statusCode,
      result: safeSerialize(error.networkError.result, 1),
    };
  }

  // ---- Apollo Error Operation ----
  if (error.operation) {
    serialized.operation = {
      operationName:
        typeof error.operation.operationName === 'string'
          ? error.operation.operationName
          : String(error.operation.operationName || ''),
      variables: safeSerialize(error.operation.variables, 1),
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

      const unknownProps: Record<string, any> = {};
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
export function isCircularStructureError(error: any): boolean {
  if (!error) return false;

  const message = typeof error === 'string' ? error : error.message || '';

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
export function isTimerCircularStructureError(error: any): boolean {
  if (!error) return false;

  const message = typeof error === 'string' ? error : error.message || '';

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
export function safeStringifyError(error: any): {
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
