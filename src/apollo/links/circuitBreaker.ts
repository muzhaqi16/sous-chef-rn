import Config from 'react-native-config';

/**
 * API Health Monitor (formerly circuit breaker) - tracks API health without blocking requests
 * Works with Apollo's built-in retry and cache policies for better offline experience
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly endpoint: string;

  constructor(
    endpoint: string,
    failureThreshold = 3,
    recoveryTimeoutMs = 60000 // 1 minute
  ) {
    this.endpoint = endpoint;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeoutMs = recoveryTimeoutMs;
  }

  /**
   * Check if circuit breaker allows requests (monitoring mode - always allows)
   */
  shouldAllowRequest(): boolean {
    const now = Date.now();

    // In monitoring mode, always allow requests but update state for observability
    switch (this.state) {
      case 'OPEN':
        // Check if enough time has passed to try recovery
        if (now - this.lastFailureTime >= this.recoveryTimeoutMs) {
          this.state = 'HALF_OPEN';
          console.log(`[API Monitor] ${this.endpoint} - Moving to HALF_OPEN state for monitoring`);
        }
        break;
    }

    // Always allow requests - this is monitoring-only
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`[API Monitor] ${this.endpoint} - Recovery successful, API health restored`);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error: any): void {
    // Continue tracking failures for monitoring purposes
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Track API health status for monitoring
    if (this.isEndpointUnreachable(error)) {
      if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.warn(
          `[API Monitor] ${this.endpoint} - API health degraded after ${this.failureCount} failures. ` +
          `Monitoring recovery (requests continue with Apollo cache-first policy)`
        );
      }
    }
  }

  /**
   * Check if error indicates endpoint is unreachable
   */
  private isEndpointUnreachable(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const networkError = error?.networkError;

    // Check for connection/DNS/timeout issues
    const connectionIssues = [
      'network request failed',
      'network error',
      'connection refused',
      'timeout',
      'enotfound',
      'econnrefused',
      'econnreset',
      'ehostunreach'
    ];

    return connectionIssues.some(issue => message.includes(issue)) ||
           networkError?.code === 'NETWORK_ERROR' ||
           networkError?.code === 'TIMEOUT';
  }

  /**
   * Get current state for debugging
   */
  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker (useful for manual recovery)
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    console.log(`[API Monitor] ${this.endpoint} - Health monitor reset, API marked healthy`);
  }
}

// Global API health monitor instance for the main API endpoint
export const apiCircuitBreaker = new CircuitBreaker(
  Config.API_URL || 'http://localhost:4000/graphql',
  3, // Track degraded health after 3 consecutive failures
  60000 // Monitor recovery after 1 minute
);

export { CircuitBreaker };