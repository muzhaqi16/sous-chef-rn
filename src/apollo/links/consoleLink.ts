import { ApolloLink, Observable } from '@apollo/client';
import performance from 'react-native-performance';
import {
  serializeError,
  safeStringifyError,
  isTimerCircularStructureError,
} from '#/utils/errorSerialization';

// Enable detailed logging only in development
const isDevelopment = __DEV__;

// Cold-start detection: first N operations have inflated timing due to JS thread contention
const COLD_START_THRESHOLD = 5;
let operationsSeen = 0;

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

    const operationName = operation.operationName || 'Unknown';
    const operationType =
      operation.query.definitions[0]?.kind === 'OperationDefinition'
        ? operation.query.definitions[0]?.operation?.toUpperCase()
        : 'UNKNOWN';
    const isSubscription = operationType === 'SUBSCRIPTION';
    const startTime = isSubscription ? 0 : performance.now();
    const operationIndex = isSubscription ? -1 : operationsSeen++;

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: result => {
          const hasErrors = result.errors && result.errors.length > 0;

          // Check for timer errors FIRST - skip ALL logging for these
          // These are expected during subscription teardown/setup due to graphql-ws internals
          if (hasErrors) {
            const safeErrors = result.errors?.map(serializeError);
            const isTimerError = safeErrors?.some(err =>
              isTimerCircularStructureError(err),
            );
            if (isTimerError) {
              observer.next(result);
              return; // Skip entire logging block
            }
          }

          // Determine status
          let emoji = '✅';
          let style = 'color: #22c55e; font-weight: bold';

          if (hasErrors) {
            emoji = '❌';
            style = 'color: #ef4444; font-weight: bold';
          } else if (!isSubscription) {
            const duration = Math.round(performance.now() - startTime);
            if (duration > slowQueryThreshold) {
              emoji = '⚠️';
              style = 'color: #f59e0b; font-weight: bold';
            }
          }

          // Log timing info
          if (logTiming) {
            if (isSubscription) {
              console.log(
                `%c🚀 ${emoji} ${operationType} ${operationName}`,
                style,
              );
            } else {
              const duration = Math.round(performance.now() - startTime);
              const coldTag =
                operationIndex < COLD_START_THRESHOLD ? ' [cold]' : '';
              console.log(
                `%c🚀 ${emoji} ${operationType} ${operationName} ${duration}ms${coldTag}`,
                style,
              );
            }
          }

          // Log variables as expandable object
          if (
            logVariables &&
            operation.variables &&
            Object.keys(operation.variables).length > 0
          ) {
            console.log('   📤 Variables:', operation.variables);
          }

          // Log errors as JSON strings to prevent React Native console serialization issues
          if (hasErrors) {
            const safeErrors = result.errors?.map(serializeError);
            const { stringified, isCircular } = safeStringifyError(safeErrors);

            if (isCircular) {
              // Log actual error details for non-timer circular errors
              console.warn('   ⚠️ GraphQL errors (may have circular refs):');
              safeErrors?.forEach((err, i: number) => {
                console.warn(
                  `      [${i}] message: ${err?.message || 'No message'}`,
                );
                if (err?.path) {
                  console.warn(`          path: ${JSON.stringify(err.path)}`);
                }
                if (err?.extensions?.code) {
                  console.warn(`          code: ${err.extensions.code}`);
                }
              });
            } else {
              console.error('   ❌ Errors:', stringified);
            }
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
        error: error => {
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
