import { ApolloLink, Observable } from '@apollo/client';
import { Kind, OperationTypeNode, type GraphQLFormattedError } from 'graphql';
import { requirePlatform } from '#platform/install';
import { env as buildEnv } from '#/config/env';
import { Telemetry } from '#/services/telemetry';
import { Environment } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { isOfflineRejectedError } from '../offlineQueue/OfflineRejectedError';
import { useStore } from '#store';
import { isNetworkError } from '#/utils/isNetworkError';

interface GraphQLTiming {
  operationName: string;
  operationType: string;
  startTime: number;
}

// `GRAPHQL_TELEMETRY_SAMPLE_RATE`, defaulting to FULL capture so an unset or
// unparseable value never silently discards production telemetry. Clamped to
// (0, 1] because `sampleWeight` divides by it.
const parseSampleRate = (raw: string | undefined): number => {
  // `Number`, not a decimal parser: this is build-env config, so it must not
  // depend on the device's separator, and a partly-numeric value is a
  // misconfiguration rather than something to salvage.
  const parsed = Number(raw ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, 1);
};

const CONFIGURED_SAMPLE_RATE = parseSampleRate(
  buildEnv.GRAPHQL_TELEMETRY_SAMPLE_RATE,
);

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

    // Sample telemetry outside dev to reduce overhead. At a rate of 1 this is
    // a no-op comparison — `Math.random()` is never > 1.
    if (
      !Environment.isDevelopment() &&
      Math.random() > CONFIGURED_SAMPLE_RATE
    ) {
      return forward(operation);
    }

    const startTime = requirePlatform('clock').now();
    const operationName = operation.operationName ?? 'unnamed';
    const [firstDefinition] = operation.query.definitions;
    const operationType =
      firstDefinition?.kind === Kind.OPERATION_DEFINITION
        ? firstDefinition.operation
        : 'unknown';
    // A subscription's elapsed time at its first push is a session length, not
    // a request latency, so it stays out of the latency metrics.
    const isSubscription = operationType === OperationTypeNode.SUBSCRIPTION;

    // Each sampled operation stands in for 1/rate real ones, so counters are
    // weighted to estimate true volume whatever the rate.
    const sampleWeight = Environment.isDevelopment()
      ? 1
      : Math.round(1 / CONFIGURED_SAMPLE_RATE);

    const operationId = `${operationName}_${startTime}`;

    timings.set(operationId, {
      operationName,
      operationType,
      startTime,
    });

    // Production's log floor is `warn`: unguarded, every operation builds a
    // payload only for `log()` to discard it.
    if (Telemetry.isLevelEnabled('debug')) {
      Telemetry.debug(`GraphQL ${operationType}: ${operationName} started`, {
        operation_type: operationType,
        operation_name: operationName,
        variables: Object.keys(operation.variables),
      });
    }

    Telemetry.increment('graphql_requests_total', sampleWeight, {
      type: operationType,
      name: operationName,
    });

    const finalizeTiming = (timing: GraphQLTiming, hasErrors: boolean) => {
      const duration = requirePlatform('clock').now() - timing.startTime;
      timings.delete(operationId);

      // NOT sample-weighted: latency quantiles are scale-invariant. Its
      // _count/_sum under-report by the sample rate, so read VOLUME from the
      // weighted graphql_requests_total counter.
      if (!isSubscription) {
        Telemetry.histogram('graphql_request_duration_ms', duration, {
          type: operationType,
          name: operationName,
          has_errors: String(hasErrors),
        });
      }

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
            } else if (Telemetry.isLevelEnabled('debug')) {
              Telemetry.debug(`GraphQL Success: ${operationName}`, {
                duration_ms: duration,
                operation_type: operationType,
              });
            }

            if (!isSubscription && duration > 1000) {
              // `operation_name` is load-bearing: this is one of the few
              // telemetryLink lines that survives production's `warn` floor,
              // and the Grafana log panel renders it by that field.
              Telemetry.warn(`Slow GraphQL query: ${operationName}`, {
                operation_name: operationName,
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

            // A subscription drops its socket on every background or network
            // change and reconnects: churn, kept out of
            // graphql_network_errors_total.
            const isExpectedSubscriptionDrop =
              operationType === OperationTypeNode.SUBSCRIPTION &&
              isNetworkError(error);

            if (isExpectedSubscriptionDrop) {
              Telemetry.warn(`Subscription ${operationName} disconnected`, {
                operation_name: operationName,
                operation_type: operationType,
                error_message: serializedError.message,
                duration_ms: duration,
                network_error: true,
              });
            } else if (isOfflineRejectedError(error)) {
              // A preemptive offline rejection never touched the network, so
              // it stays out of graphql_network_errors_total.
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

      return () => {
        subscription.unsubscribe();
        // An operation cancelled by an unmount never reaches `finalizeTiming`,
        // so without this its entry is retained for the life of the session.
        timings.delete(operationId);
      };
    });
  });
};
