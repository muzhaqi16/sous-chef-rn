import { ApolloLink, Observable } from '@apollo/client';
import type { GraphQLFormattedError } from 'graphql';
import performance from 'react-native-performance';
import { env as buildEnv } from '#/config/env';
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

// Fraction of non-dev GraphQL operations that carry telemetry, from
// `GRAPHQL_TELEMETRY_SAMPLE_RATE` (build-time env). Configurable rather than a
// constant so the rate can be lowered per environment as the fleet grows —
// without it, "turn sampling down" was a code change.
//
// Defaults to full capture: an unset or unparseable value must not silently
// discard 90% of production telemetry. Clamped to (0, 1] because
// `sampleWeight` divides by it.
const parseSampleRate = (raw: string | undefined): number => {
  const parsed = Number.parseFloat(raw ?? '');
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

    const startTime = performance.now();
    const operationName = operation.operationName || 'unnamed';
    const operationType =
      operation.query.definitions[0]?.kind === 'OperationDefinition'
        ? operation.query.definitions[0]?.operation || 'unknown'
        : 'unknown';
    // A subscription stays open for the life of the screen, so the elapsed
    // time at its first server push is a session length, not a request
    // latency. Keep those observations out of the latency metrics entirely —
    // a single PantryEvents socket has reported 194s, which alone drags every
    // percentile in graphql_request_duration_ms past the top bucket.
    const isSubscription = operationType === 'subscription';

    // Only a `CONFIGURED_SAMPLE_RATE` share of operations reach this point (see
    // the gate above), so each one stands in for 1/rate real operations. Weight
    // counter increments accordingly so totals estimate true volume regardless
    // of the rate. At the current rate of 1 the weight is 1 and the counters
    // are exact counts — note that makes them NOT comparable with series
    // recorded while the rate was 0.1, which were 10× estimates.
    const sampleWeight = Environment.isDevelopment()
      ? 1
      : Math.round(1 / CONFIGURED_SAMPLE_RATE);

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

    // Guarded: production's log floor is `warn`, so unguarded this walked
    // `operation.variables` and built a payload for every operation only for
    // `log()` to discard it — cheap per call, but now on every operation
    // rather than one in ten.
    if (Telemetry.isLevelEnabled('debug')) {
      Telemetry.debug(`GraphQL ${operationType}: ${operationName} started`, {
        operation_type: operationType,
        operation_name: operationName,
        variables: operation.variables ? Object.keys(operation.variables) : [],
      });
    }

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
