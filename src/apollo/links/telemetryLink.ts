import { ApolloLink, Observable } from '@apollo/client';
import type { GraphQLFormattedError } from 'graphql';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { isExpectedNetworkTransitionError } from '#/utils/subscriptionErrorHandler';
import { isOfflineRejectedError } from '../offlineQueue/OfflineRejectedError';
import { useStore } from '#store';

interface GraphQLTiming {
  operationName: string;
  operationType: string;
  startTime: number;
  markName: string;
}

// Sample rate for production telemetry (10% of operations)
const PRODUCTION_SAMPLE_RATE = 0.1;

export const createTelemetryLink = () => {
  const timings = new Map<string, GraphQLTiming>();

  return new ApolloLink((operation, forward) => {
    // Skip all telemetry overhead when user has explicitly disabled data sharing
    if (useStore.getState().userConsent === false) {
      return forward(operation);
    }

    if (!Environment.shouldEnableAnalytics() && !Environment.isDevelopment()) {
      return forward(operation);
    }

    // Sample telemetry in production to reduce overhead
    if (
      !Environment.isDevelopment() &&
      Math.random() > PRODUCTION_SAMPLE_RATE
    ) {
      return forward(operation);
    }

    const startTime = performance.now();
    const operationName = operation.operationName || 'unnamed';
    const operationType =
      operation.query.definitions[0]?.kind === 'OperationDefinition'
        ? operation.query.definitions[0]?.operation || 'unknown'
        : 'unknown';

    // In production only 1-in-PRODUCTION_SAMPLE_RATE operations reach this
    // point (see sampling gate above), so each sampled operation stands in for
    // 1/sampleRate real ones. Weight counter increments accordingly so totals
    // estimate true volume instead of under-reporting ~10×. Dev is unsampled.
    const sampleWeight = Environment.isDevelopment()
      ? 1
      : Math.round(1 / PRODUCTION_SAMPLE_RATE);

    const operationId = `${operationName}_${startTime}`;
    const markName = `gql:${operationName}:${operationId}`;

    // Place a mark for timeline visibility
    performance.mark(markName);

    timings.set(operationId, {
      operationName,
      operationType,
      startTime,
      markName,
    });

    Telemetry.debug(`GraphQL ${operationType}: ${operationName} started`, {
      operation_type: operationType,
      operation_name: operationName,
      variables: operation.variables ? Object.keys(operation.variables) : [],
    });

    Telemetry.increment('graphql_requests_total', sampleWeight, {
      type: operationType,
      name: operationName,
    });

    const finalizeTiming = (timing: GraphQLTiming, hasErrors: boolean) => {
      const duration = performance.now() - timing.startTime;
      timings.delete(operationId);

      // Create a measure for timeline visibility, then clean up the mark
      try {
        performance.measure(`gql:${operationName}`, timing.markName);
      } catch {
        // Mark may have been cleared
      }
      performance.clearMarks(timing.markName);

      // Report directly with full labels (central observer skips gql:* measures).
      // Intentionally NOT sample-weighted: latency quantiles are scale-invariant,
      // so one observation per sampled op is correct. Its _count/_sum therefore
      // under-report by the sample rate in prod — read request VOLUME from the
      // weighted graphql_requests_total counter, not from this histogram.
      Telemetry.histogram('graphql_request_duration_ms', duration, {
        type: operationType,
        name: operationName,
        has_errors: String(hasErrors),
      });

      return duration;
    };

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: response => {
          const timing = timings.get(operationId);
          if (timing) {
            const hasErrors = !!(response.errors && response.errors.length > 0);
            const duration = finalizeTiming(timing, hasErrors);

            if (response.errors && response.errors.length > 0) {
              response.errors.forEach((error: GraphQLFormattedError) => {
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
                    errorExtensions =
                      'Extensions contained circular references';
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

              Telemetry.increment(
                'graphql_errors_total',
                response.errors.length * sampleWeight,
                {
                  type: operationType,
                  name: operationName,
                },
              );
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

              Telemetry.increment('graphql_slow_queries_total', sampleWeight, {
                type: operationType,
                name: operationName,
              });
            }
          }

          observer.next(response);
        },
        error: (error: unknown) => {
          const timing = timings.get(operationId);
          if (timing) {
            const duration = finalizeTiming(timing, true);

            // Serialize error to avoid circular reference issues from WebSocket timers
            const serializedError = serializeError(error);

            // Subscriptions drop their socket on every app background / network
            // change and auto-reconnect — that's expected churn, not a fault.
            // Log it at warn and keep it out of graphql_network_errors_total so
            // the error dashboards stay meaningful.
            const isExpectedSubscriptionDrop =
              operationType === 'subscription' &&
              isExpectedNetworkTransitionError(serializedError.message);

            if (isExpectedSubscriptionDrop) {
              Telemetry.warn(`Subscription ${operationName} disconnected`, {
                operation_name: operationName,
                operation_type: operationType,
                error_message: serializedError.message,
                duration_ms: duration,
                network_error: true,
              });
            } else if (isOfflineRejectedError(error)) {
              // A preemptive offline rejection — a real user-facing failure, but
              // it never touched the network. Keep it out of
              // graphql_network_errors_total so the error dashboards reflect
              // actual API failures, not offline UX.
              Telemetry.warn(`${operationName} rejected: device offline`, {
                operation_name: operationName,
                operation_type: operationType,
                error_message: serializedError.message,
                duration_ms: duration,
                network_error: false,
              });
            } else {
              Telemetry.error(`GraphQL Network Error in ${operationName}`, {
                operation_name: operationName,
                operation_type: operationType,
                error_message: serializedError.message,
                error_name: serializedError.name,
                error_stack: serializedError.stack,
                duration_ms: duration,
                network_error: true,
              });

              Telemetry.increment(
                'graphql_network_errors_total',
                sampleWeight,
                {
                  type: operationType,
                  name: operationName,
                },
              );
            }
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
