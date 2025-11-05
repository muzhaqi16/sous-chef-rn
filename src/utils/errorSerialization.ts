/**
 * Safely serializes error objects for logging, avoiding circular reference issues
 * that can occur with Timer/Timeout objects in Apollo/WebSocket errors.
 */
export function serializeError(error: any): Record<string, any> {
  if (!error) {
    return { message: 'Unknown error' };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return { message: error };
  }

  const serialized: Record<string, any> = {
    message: error.message || 'Unknown error',
  };

  // Add common error properties
  if (error.name) serialized.name = error.name;
  if (error.code) serialized.code = error.code;

  // Safely handle stack traces (only if it's a string to avoid circular refs)
  if (error.stack && typeof error.stack === 'string') {
    serialized.stack = error.stack;
  }

  // Handle Apollo GraphQL errors
  if (error.graphQLErrors) {
    serialized.graphQLErrors = error.graphQLErrors.map((e: any) => ({
      message: e.message,
      path: e.path,
      extensions: e.extensions,
    }));
  }

  // Handle Apollo network errors (avoid serializing the full networkError object)
  if (error.networkError) {
    serialized.networkError = {
      message: error.networkError.message,
      name: error.networkError.name,
      statusCode: error.networkError.statusCode,
    };
  }

  // Handle other common properties
  if (error.extraInfo) serialized.extraInfo = error.extraInfo;
  if (error.operation) serialized.operation = error.operation;

  return serialized;
}
