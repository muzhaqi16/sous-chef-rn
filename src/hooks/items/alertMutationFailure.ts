import { alertService } from '#/services/alertService';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';

// Minimal structural type for the translation function so this doesn't depend
// on i18next's generic key typing — both callers pass their `useTranslation` t.
type Translate = (key: string, options?: Record<string, unknown>) => string;

interface AlertMutationFailureOptions {
  /** i18n namespace whose keys hold this flow's alert copy. */
  keyPrefix: string;
  /** The mutation result, read only for a top-level rate-limit error. */
  result?: { error?: unknown };
  /** The resolved union member, read for its `__typename` and `message`. */
  payload?: { __typename?: string; message?: string | null } | null;
  /**
   * Per-flow error branches keyed by `__typename`, resolved under `keyPrefix`
   * and checked before the shared not-found / validation / generic switch.
   */
  extraCases?: Record<string, { titleKey: string; bodyKey: string }>;
}

/**
 * Surfaces a report-item / suggest-edit mutation failure as a single alert. A
 * top-level rate-limit error wins over any payload branch; otherwise a per-flow
 * `extraCases` entry, then the shared not-found / validation / generic branches,
 * resolve their copy under `keyPrefix`.
 */
export function alertMutationFailure(
  t: Translate,
  { keyPrefix, result, payload, extraCases }: AlertMutationFailureOptions,
): void {
  // Per-operation rate limits arrive as a TOP-LEVEL GraphQL error, never a
  // union member — check before falling through to the payload branches.
  if (result && isRateLimitError(result.error)) {
    alertService.alert(
      t(`${keyPrefix}.rateLimitedTitle`),
      getRateLimitMessage(result.error),
    );
    return;
  }

  const typename = payload?.__typename;

  const extra = typename ? extraCases?.[typename] : undefined;
  if (extra) {
    alertService.alert(
      t(`${keyPrefix}.${extra.titleKey}`),
      t(`${keyPrefix}.${extra.bodyKey}`),
    );
    return;
  }

  switch (typename) {
    case 'NotFoundError':
      alertService.alert(
        t(`${keyPrefix}.notFoundTitle`),
        t(`${keyPrefix}.notFoundBody`),
      );
      return;
    case 'ValidationError':
      // Server-authored and field-specific — the most useful thing we have.
      alertService.alert(
        t(`${keyPrefix}.rejectedTitle`),
        payload?.message || t(`${keyPrefix}.failedBody`),
      );
      return;
    default:
      alertService.alert(
        t(`${keyPrefix}.failedTitle`),
        t(`${keyPrefix}.failedBody`),
      );
  }
}
