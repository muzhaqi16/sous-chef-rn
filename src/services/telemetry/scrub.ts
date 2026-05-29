/**
 * Redaction for telemetry logs. Applied centrally in `TelemetryService.log()`
 * so every path (trackError, errorService, globalErrorHandler, ErrorBoundary,
 * telemetryLink) is scrubbed before anything reaches Loki. Logs can carry error
 * stacks, GraphQL variables, and rejection reasons that may contain emails,
 * tokens, or passwords.
 */

// Object keys whose values are redacted wholesale (case-insensitive substring).
// Intentionally excludes a bare "auth" so it doesn't match "author".
const SENSITIVE_KEY =
  /password|passwd|token|secret|authorization|credential|cookie|session|api[-_]?key|jwt|bearer|email/i;

// Value patterns redacted wherever they appear inside a string.
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Long opaque blobs (JWTs, API tokens, base64). 40+ char runs without spaces.
const LONG_TOKEN = /\b[A-Za-z0-9._-]{40,}\b/g;

const REDACTED = '[REDACTED]';
const MAX_STRING = 2000;
const MAX_DEPTH = 4;

export function scrubString(value: string): string {
  let out = value.replace(EMAIL, REDACTED).replace(LONG_TOKEN, REDACTED);
  if (out.length > MAX_STRING) {
    out = `${out.slice(0, MAX_STRING)}…[truncated]`;
  }
  return out;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return '[Array]';
    }
    return value.map(item => scrubValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (depth >= MAX_DEPTH) {
      return '[Object]';
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : scrubValue(val, depth + 1);
    }
    return out;
  }
  // number | boolean | null | undefined — nothing to redact.
  return value;
}

export function scrubLogExtra(
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  if (!extra) {
    return {};
  }
  return scrubValue(extra, 0) as Record<string, unknown>;
}
