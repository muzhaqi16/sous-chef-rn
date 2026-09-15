/**
 * Serializes any Apollo / Network / JS error to a JSON-friendly object without
 * throwing. A WeakSet tracks visited objects against circular references, and
 * depth is capped so a huge Apollo context object is not walked whole.
 */

/** Narrows an opaque value to an indexable object, so no `any` is needed. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `String(value)` for a primitive; an object reads as its tag, never through its own `toString`. */
export function describeValue(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
    case 'undefined':
      return String(value);
    case 'function':
    case 'object':
      return value === null ? 'null' : Object.prototype.toString.call(value);
  }
}

/** '' when the value carries no string `message`. */
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
 * Keeps a message-less error attributable in logs instead of collapsing to a
 * bare "Unknown error". `getOwnPropertyNames` because Error fields are often
 * non-enumerable.
 */
function describeMessagelessError(error: Record<string, unknown>): string {
  const ctor = (error as { constructor?: { name?: unknown } }).constructor;
  const ctorName =
    typeof ctor?.name === 'string' && ctor.name !== 'Object' ? ctor.name : '';
  const name = (typeof error.name === 'string' && error.name) || ctorName;
  const props = Object.getOwnPropertyNames(error).slice(0, 10).join(', ');
  const hints = [name, props && `props: ${props}`].filter(Boolean).join('; ');
  return hints ? `Unknown error (${hints})` : 'Unknown error';
}

/**
 * The well-known Apollo/JS fields are typed so readers index them without casts;
 * the index signature keeps the object open for `additionalProperties`.
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
  // Name the falsy value so "rejected with null" and "rejected with
  // undefined/''/0" are distinguishable in logs.
  if (!error) {
    const description =
      error === null
        ? 'null'
        : error === ''
        ? 'empty string'
        : describeValue(error);
    return { message: `Unknown error (${description})` };
  }
  if (typeof error === 'string') return { message: error };
  if (!isRecord(error)) return { message: describeValue(error) };

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
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      try {
        output[key] = safeSerialize(Reflect.get(value, key), depth + 1);
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
        : describeMessagelessError(error),
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
            : describeValue(gqlErr.message || ''),
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
          : describeValue(networkError.name || 'NetworkError'),
      message:
        typeof networkError.message === 'string'
          ? networkError.message
          : describeValue(networkError.message || ''),
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
          : describeValue(operation.operationName || ''),
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

/** Aborts `JSON.stringify` at the first reference cycle, carrying the path to it. */
class ReferenceCycle extends Error {
  override readonly name = 'ReferenceCycle';

  constructor(
    readonly path: readonly object[],
    readonly cycle: readonly object[],
  ) {
    super('reference cycle');
  }
}

// `JSON.stringify` calls a replacer with the holder as `this`; unwinding the
// stack to it leaves exactly the ancestors of `value`, so a repeat is a cycle
// and a reference shared between siblings is not.
function cycleGuard(): (this: unknown, key: string, value: unknown) => unknown {
  const ancestors: object[] = [];
  return function guard(this: unknown, _key: string, value: unknown) {
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (typeof value === 'object' && value !== null) {
      const at = ancestors.indexOf(value);
      if (at !== -1) {
        throw new ReferenceCycle([...ancestors], ancestors.slice(at));
      }
      ancestors.push(value);
    }
    return value;
  };
}

type Stringified =
  | { outcome: 'ok'; text: string }
  | { outcome: 'cycle'; found: ReferenceCycle }
  | { outcome: 'failed'; thrown: unknown };

function stringify(value: unknown, space?: number): Stringified {
  try {
    return { outcome: 'ok', text: JSON.stringify(value, cycleGuard(), space) };
  } catch (thrown) {
    return thrown instanceof ReferenceCycle
      ? { outcome: 'cycle', found: thrown }
      : { outcome: 'failed', thrown };
  }
}

/** Stringifies an error, reporting a reference cycle instead of throwing. */
export function safeStringifyError(error: unknown): {
  stringified: string;
  isCircular: boolean;
  message: string;
} {
  if (typeof error === 'string') {
    return { stringified: error, isCircular: false, message: '' };
  }

  const result = stringify(error, 2);
  switch (result.outcome) {
    case 'ok':
      return { stringified: result.text, isCircular: false, message: '' };
    case 'cycle': {
      // Within an array, the message is the entry that holds the cycle.
      const [root, entry] = result.found.path;
      const subject = Array.isArray(root) ? entry : error;
      const message = getErrorMessage(subject) || 'Unknown error';
      return {
        stringified: `[Circular structure detected] ${message}`,
        isCircular: true,
        message,
      };
    }
    case 'failed': {
      const message = getErrorMessage(result.thrown);
      return {
        stringified: `[Error serializing: ${message}]`,
        isCircular: false,
        message,
      };
    }
  }
}
