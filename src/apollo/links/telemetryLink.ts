import { ApolloLink, Operation, FetchResult, Observable } from '@apollo/client';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';

interface GraphQLTiming {
  operationName: string;
  operationType: string;
  startTime: number;
}

export const createTelemetryLink = () => {
  const timings = new Map<string, GraphQLTiming>();

  return new ApolloLink((operation: Operation, forward) => {
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
        next: (response: FetchResult) => {
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
                Telemetry.error(`GraphQL Error in ${operationName}`, {
                  operation_name: operationName,
                  operation_type: operationType,
                  error_message: error.message,
                  error_path: error.path ? JSON.stringify(error.path) : undefined,
                  duration_ms: duration,
                  error_extensions: error.extensions ? JSON.stringify(error.extensions) : undefined,
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

            Telemetry.error(`GraphQL Network Error in ${operationName}`, {
              operation_name: operationName,
              operation_type: operationType,
              error_message: error.message,
              error_stack: error.stack,
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