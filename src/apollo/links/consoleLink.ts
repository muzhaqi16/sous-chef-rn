import {ApolloLink, Observable} from '@apollo/client';

// Enable detailed logging only in development
const isDevelopment = __DEV__;

export const createConsoleLink = (
  options: {
    enabled?: boolean;
    logVariables?: boolean;
    logQuery?: boolean;
    logResponse?: boolean;
    logTiming?: boolean;
    slowQueryThreshold?: number;
  } = {},
) => {
  const {
    enabled = isDevelopment,
    logVariables = true,
    logQuery = false,
    logResponse = false, // Changed default to false to reduce noise
    logTiming = true,
    slowQueryThreshold = 1000,
  } = options;

  return new ApolloLink((operation, forward) => {
    if (!enabled) {
      return forward(operation);
    }

    const startTime = Date.now();
    const operationName = operation.operationName || 'Unknown';
    const operationType =
      operation.query.definitions[0]?.kind === 'OperationDefinition'
        ? operation.query.definitions[0]?.operation?.toUpperCase()
        : 'UNKNOWN';

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: (result: any) => {
          const duration = Date.now() - startTime;
          const hasErrors = result.errors && result.errors.length > 0;

          // Determine status
          let emoji = '✅';
          let style = 'color: #22c55e; font-weight: bold';

          if (hasErrors) {
            emoji = '❌';
            style = 'color: #ef4444; font-weight: bold';
          } else if (duration > slowQueryThreshold) {
            emoji = '⚠️';
            style = 'color: #f59e0b; font-weight: bold';
          }

          // Log timing info
          if (logTiming) {
            console.log(
              `%c🚀 ${emoji} ${operationType} ${operationName} ${duration}ms`,
              style
            );
          }

          // Log variables as expandable object
          if (
            logVariables &&
            operation.variables &&
            Object.keys(operation.variables).length > 0
          ) {
            console.log('   📤 Variables:', operation.variables);
          }

          // Log errors as expandable objects
          if (hasErrors) {
            console.error('   ❌ Errors:', result.errors);
          }

          // Log response data as expandable object
          if (logResponse && result.data) {
            console.log('   📥 Data:', result.data);
          }

          // Log query if requested
          if (logQuery && operation.query.loc?.source.body) {
            console.log('   📋 Query:', operation.query.loc.source.body);
          }

          // Log extensions if present
          if (result.extensions) {
            console.log('   🔧 Extensions:', result.extensions);
          }

          observer.next(result);
        },
        error: (error) => {
          observer.error(error);
        },
        complete: () => {
          observer.complete();
        },
      });

      // Return cleanup function
      return () => subscription.unsubscribe();
    });
  });
};
