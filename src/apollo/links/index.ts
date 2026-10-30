import { ApolloLink } from '@apollo/client';
import { authLink } from './authLink';
import { languageLink } from './languageLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { createOfflineModeLink } from './offlineModeLink';
import { createLocalWritePrecedenceLink } from './localWritePrecedenceLink';
import { createAnswerOrderingLink } from './answerOrderingLink';
import { createNetworkStatusLink } from './networkStatusLink';
import { createClientReleaseLink } from './clientReleaseLink';
import { errorLink } from './errorLink';
import { retryLink } from './retryLink';
import { createTransportLink } from './transportLink';
import { createQueueLink } from '../offlineQueue/queueLink';

/**
 * Create link chain for Apollo client
 * Full-featured configuration with offline support
 */
export function createLink() {
  // Console link configuration - only verbose in development
  const consoleLink = createConsoleLink({
    enabled: __DEV__,
    logVariables: __DEV__,
    logQuery: false, // Too verbose, disable even in dev
    logResponse: false, // Too verbose, disable even in dev
    logTiming: true,
    slowQueryThreshold: 1000,
  });

  // Telemetry link for tracking GraphQL operations
  const telemetryLink = createTelemetryLink();

  // Offline mode link - blocks queries when user has enabled offline mode
  const offlineModeLink = createOfflineModeLink();

  // Network status link - drives the API-reachability circuit breaker
  const networkStatusLink = createNetworkStatusLink();

  // Reads the server's soft "a newer build exists" signal off response extensions
  const clientReleaseLink = createClientReleaseLink();

  // Queue link for offline mutation support
  const queueLink = createQueueLink();

  // Order matters: offlineModeLink first, so blocked queries never reach
  // retryLink/errorLink as doomed requests. Deduplication is Apollo's own
  // `queryDeduplication: true`.
  const transportLink = createTransportLink();

  return ApolloLink.from([
    offlineModeLink, // Block queries when effectively offline (before telemetry to skip tracking)
    // Sees every read that may reach the network, and a re-sent read still
    // passes retry, error, auth and transport.
    createLocalWritePrecedenceLink(), // A read in flight never undoes a local-first write
    // Under the precedence link, so it and Apollo only see ordered answers.
    createAnswerOrderingLink(), // An answer's older copy of a row never replaces a newer one
    networkStatusLink, // Feed the API-reachability circuit breaker (one outcome/op)
    clientReleaseLink, // Surface the server's "newer build available" extension
    telemetryLink, // Track operations for monitoring
    retryLink, // Retry transient network failures (queries only)
    errorLink, // Handle/log errors + return cached data on network failures
    languageLink, // Accept-Language: catalog names resolve by it
    authLink, // Authentication headers (keeps the headers set before it)
    queueLink, // Queue mutations when offline
    consoleLink, // Development logging
    transportLink, // HTTP/WebSocket transport
  ]);
}
