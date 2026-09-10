/** Sub-millisecond timings read as microseconds; anything longer as ms. */
export const formatTime = (ms: number): string =>
  ms < 1 ? `${(ms * 1000).toFixed(0)}μs` : `${ms.toFixed(2)}ms`;

export const formatMemory = (bytes: number): string =>
  `${(bytes / 1024 / 1024).toFixed(2)}MB`;

export const formatTimestamp = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString();
