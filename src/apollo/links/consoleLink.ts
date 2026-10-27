import { ApolloLink, Observable } from '@apollo/client';
import { Kind } from 'graphql';
import { serializeError, safeStringifyError } from '#/utils/errorSerialization';

// Enable detailed logging only in development
const isDevelopment = __DEV__;

// A dev console is read over shoulders, pasted into issues and captured by
// screen recordings, so the credential a sign-in carries is masked here too.
const SENSITIVE_VARIABLE =
  /password|token|secret|credential|api[-_]?key|authorization/i;

// Every auth operation takes a single `$input`, so masking only the top level
// would leave the credential one key down — exactly where it always is.
const MAX_MASK_DEPTH = 6;

function maskValue(value: unknown, depth: number): unknown {
  if (depth >= MAX_MASK_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(entry => maskValue(entry, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = SENSITIVE_VARIABLE.test(key)
      ? '[MASKED]'
      : maskValue(nested, depth + 1);
  }
  return out;
}

// A terminal or log file records an object argument as `Object`, so values go
// out as indented JSON text under their label, masked, and capped by lines so a
// large batch can't flood the console.
const MAX_LOGGED_LINES = 40;
const JSON_INDENT = '      ';

function asJson(value: unknown): string {
  const lines = JSON.stringify(maskValue(value, 0), null, 2).split('\n');
  const shown =
    lines.length > MAX_LOGGED_LINES
      ? [...lines.slice(0, MAX_LOGGED_LINES), '…']
      : lines;
  return shown.map(line => `${JSON_INDENT}${line}`).join('\n');
}

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

    const operationName = operation.operationName ?? 'Unknown';
    const [firstDefinition] = operation.query.definitions;
    const operationType =
      firstDefinition?.kind === Kind.OPERATION_DEFINITION
        ? firstDefinition.operation.toUpperCase()
        : 'UNKNOWN';
    const isSubscription = operationType === 'SUBSCRIPTION';
    const startTime = isSubscription ? 0 : performance.now();
    const operationIndex = isSubscription ? -1 : operationsSeen++;

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: result => {
          const hasErrors = result.errors && result.errors.length > 0;

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

          if (logVariables && Object.keys(operation.variables).length > 0) {
            console.log(`   📤 Variables:\n${asJson(operation.variables)}`);
          }

          // Log errors as JSON strings to prevent React Native console serialization issues
          if (hasErrors) {
            const safeErrors = result.errors?.map(serializeError);
            const { stringified, isCircular } = safeStringifyError(safeErrors);

            if (isCircular) {
              // Log actual error details for non-timer circular errors
              console.warn('   ⚠️ GraphQL errors (may have circular refs):');
              safeErrors?.forEach((err, i) => {
                console.warn(
                  `      [${i}] message: ${err.message || 'No message'}`,
                );
              });
            } else {
              console.error('   ❌ Errors:', stringified);
            }
          }

          if (logResponse && result.data) {
            console.log(`   📥 Data:\n${asJson(result.data)}`);
          }

          // Log query if requested
          if (logQuery && operation.query.loc?.source.body) {
            console.log('   📋 Query:', operation.query.loc.source.body);
          }

          // Log extensions if present
          if (result.extensions) {
            console.log(`   🔧 Extensions:\n${asJson(result.extensions)}`);
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
