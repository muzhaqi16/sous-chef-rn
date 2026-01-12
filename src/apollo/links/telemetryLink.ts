import { ApolloLink, Observable } from '@apollo/client';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';

interface GraphQLTiming {
  operationName: string;
  operationType: string;
  startTime: number;
}

export const createTelemetryLink = () => {
  const timings = new Map<string, GraphQLTiming>();

  return new ApolloLink((operation, forward) => {
    if (!Environment.shouldEnableAnalytics() && !Environment.isDevelopment()) {
      return forward(operation);
    }

    const startTime = Date.now();
    const operationName = operation.operationName || 'unnamed';
    const operationType = operation.query.definitions[0]?.kind === 'OperationDefinition'
      ? operation.query.definitions[0]?.operation || 'unknown'
      : 'unknown';

    const operationId = `${operationName}_${startTime}`;

    timings.set(operationId, {
      operationName,
      operationType,
      startTime,
    });

    Telemetry.debug(`GraphQL ${operationType}: ${operationName} started`, {
      operation_type: operationType,
      operation_name: operationName,
      variables: operation.variables ? Object.keys(operation.variables) : [],
    });

    Telemetry.increment('graphql_requests_total', 1, {
      type: operationType,
      name: operationName,
    });

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: (response) => {
          const timing = timings.get(operationId);
          if (timing) {
            const duration = Date.now() - timing.startTime;
            timings.delete(operationId);

            Telemetry.histogram('graphql_request_duration_ms', duration, {
              type: operationType,
              name: operationName,
              has_errors: String(!!response.errors),
            });

            if (response.errors && response.errors.length > 0) {
              response.errors.forEach((error: any) => {
                // Safely serialize error.path
                let errorPath: string | undefined;
                if (error.path) {
                  try {
                    errorPath = JSON.stringify(error.path);
                  } catch {
                    errorPath = 'Path contained circular references';
                  }
                }

                // Safely serialize error.extensions
                let errorExtensions: string | undefined;
                if (error.extensions) {
                  try {
                    errorExtensions = JSON.stringify(error.extensions);
                  } catch {
                    errorExtensions = 'Extensions contained circular references';
                  }
                }

                Telemetry.error(`GraphQL Error in ${operationName}`, {
                  operation_name: operationName,
                  operation_type: operationType,
                  error_message: error.message,
                  error_path: errorPath,
                  duration_ms: duration,
                  error_extensions: errorExtensions,
                });
              });

              Telemetry.increment('graphql_errors_total', response.errors.length, {
                type: operationType,
                name: operationName,
              });
            } else {
              Telemetry.debug(`GraphQL Success: ${operationName}`, {
                duration_ms: duration,
                operation_type: operationType,
              });
            }

            if (duration > 1000) {
              Telemetry.warn(`Slow GraphQL query: ${operationName}`, {
                duration_ms: duration,
                operation_type: operationType,
              });

              Telemetry.increment('graphql_slow_queries_total', 1, {
                type: operationType,
                name: operationName,
              });
            }
          }

          observer.next(response);
        },
        error: (error: any) => {
          const timing = timings.get(operationId);
          if (timing) {
            const duration = Date.now() - timing.startTime;
            timings.delete(operationId);

            // Serialize error to avoid circular reference issues from WebSocket timers
            const serializedError = serializeError(error);

            Telemetry.error(`GraphQL Network Error in ${operationName}`, {
              operation_name: operationName,
              operation_type: operationType,
              error_message: serializedError.message,
              error_name: serializedError.name,
              error_stack: serializedError.stack,
              duration_ms: duration,
              network_error: true,
            });

            Telemetry.increment('graphql_network_errors_total', 1, {
              type: operationType,
              name: operationName,
            });
          }

          observer.error(error);
        },
        complete: () => {
          observer.complete();
        },
      });

      return () => subscription.unsubscribe();
    });
  });
};