import { alertService } from '#/services/alertService';
import { classifyCreateResult } from './classifyCreateResult';
import { validationFieldName } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

/**
 * What to show for a refusal: copy for the input it named, or the caller's own.
 *
 * A field-specific `ValidationError` says WHICH input was refused, and that is
 * the actionable part — a caller alerting "Failed to update item" for four
 * different sub-inputs in one mutation tells the user nothing. So `field`
 * selects a string from `errors.field.*`, and an unmapped field falls back to
 * the caller's copy, which means adding a mapping is opt-in and never breaks a
 * site that has not got one.
 *
 * The server's `message` is deliberately not used, however specific it is. It
 * is English — the client sends no `Accept-Language` and the token carries no
 * locale, so the server has nothing to localize against — and the API's own
 * guidance is to map codes to localized copy client-side rather than display
 * its strings. Showing it would put English in front of every es / it / sq
 * user and skip every i18n guard the app applies to its own copy.
 *
 * The cost, recorded honestly: one field can carry more than one rule. `unit`
 * refuses both "batches still exist" and "no conversion path", so its string
 * has to name both remedies rather than the one that applies.
 *
 * Derived here rather than at each call site because both helpers already hold
 * the result, and every rejected mutation passes through one of them.
 *
 * **This deliberately does NOT fall through to `code`, unlike its sibling
 * {@link localizedRefusalMessage}.** The asymmetry looks like an oversight and
 * is not: these two resolve copy for different situations. This one backs an
 * ALERT raised by a caller that knows which operation the user just attempted,
 * and that context is what an alert needs — "Failed to discard expired items"
 * beats `NOT_FOUND`'s "The requested item was not found", which names no
 * operation and leaves the user asking which item. Same for a fieldless
 * `ValidationError`, whose `VALIDATION_FAILED` resolves to a generic "check
 * your input". `localizedRefusalMessage` consults `code` because its callers
 * hold a payload and no such context.
 *
 * Delegating this to the sibling was tried; it regressed the copy at three
 * call sites covered by tests, which is the evidence for keeping the split.
 */
const rejectionMessage = (result: { data?: unknown }, fallback: string) => {
  const field = validationFieldName(result.data);
  if (!field) return fallback;
  // i18next resolves the fallback itself, so an unmapped field is not an error
  // and never renders a raw key.
  return t(`errors.field.${field}`, { defaultValue: fallback });
};

/**
 * The same resolution, for a refusal PAYLOAD held directly rather than a
 * mutation result — the shape a toast-based caller has.
 *
 * Field first (the actionable part), then the error code, then the caller's
 * localized fallback. The payload's own `message` is never a candidate, for the
 * reasons above: it is unlocalizable English by construction.
 */
export function localizedRefusalMessage(
  payload:
    | { __typename?: string; code?: string | null; field?: string | null }
    | null
    | undefined,
  fallback: string,
): string {
  const field =
    payload?.__typename === 'ValidationError' && payload.field
      ? payload.field.split('.').pop()
      : null;
  if (field) return t(`errors.field.${field}`, { defaultValue: fallback });

  return payload?.code
    ? errorService.getUserFriendlyMessage(payload.code, fallback)
    : fallback;
}

/**
 * Surface a user-facing alert when a local-first mutation is classified as
 * `'rejected'` by {@link classifyCreateResult}.
 *
 * A transport/GraphQL error already reaches the user through the mutation's
 * `onError`. A non-success union payload (`ValidationError` / `ForbiddenError` /
 * `NotFoundError` / `ConflictError`) resolves with HTTP 200 and no `error`, so
 * `onError` never fires — without this the optimistic revert happens silently
 * and the change just snaps back with no explanation.
 *
 * Call only on the `'rejected'` branch, and ONLY from a hook whose same-mutation
 * `onError` handles the transport-error case (the `onError` callback DOES fire for
 * a resolved `result.error` under `errorPolicy:'all'`, per AC4). This alerts solely
 * when there is no `error`, so the two never double-alert. If the site has NO
 * mutation `onError`, use {@link alertIfRejected} instead — it surfaces the
 * `result.error` case too. Mixing the wrong one either double-alerts or goes silent.
 */
export function alertRejectedMutation(
  result: { data?: unknown; error?: unknown } | null | undefined,
  message: string,
): void {
  if (!result?.error) {
    alertService.alert(
      t('labels.error'),
      rejectionMessage(result ?? {}, message),
    );
  }
}

/**
 * Classify a resolved mutation result and, if it's a rejection, alert `message`
 * and return `true`. Returns `false` for the success and offline-queued cases.
 *
 * "Rejection" covers BOTH a resolved `*Error` union member AND a resolved
 * transport/GraphQL error (`{ data: undefined, error }` — under `errorPolicy:
 * 'all'` mutations resolve with the error rather than throwing). It alerts
 * **unconditionally** (unlike {@link alertRejectedMutation}, which suppresses the
 * `result.error` case for callers that keep a mutation `onError`). Use this at
 * sites WITHOUT a mutation `onError` so there is exactly one alerter — the
 * `executeMutation` callback only fires on a real throw, which `errorPolicy:'all'`
 * makes rare, and is mutually exclusive with this (an early `if (!result) return`
 * runs first on a throw).
 *
 * Packages the `classifyCreateResult(...) === 'rejected'` check + the alert so the
 * rejected branch is a single call:
 *
 * ```ts
 * if (alertIfRejected(result, t('errors.updateMemberRoleFailed'))) {
 *   revertSnapshot();   // site-specific cleanup
 *   return false;
 * }
 * ```
 *
 * **A falsy result returns `false` here, where `classifyCreateResult` returns
 * `'rejected'`.** The two answer different questions and the split is load-bearing,
 * not an oversight: `classifyCreateResult` asks "did the write land?" (a throw
 * means it didn't), while this asks "does the user still need telling?" — and on
 * a throw they don't, because `executeMutation`'s own `onError` already reported
 * it. Collapsing the two contracts would double-alert at every call site. That is
 * why callers keep an `if (!result) return …` guard above this call: it isn't
 * redundant, it distinguishes "already reported" from "reverted silently".
 */
export function alertIfRejected(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
  message: string,
): boolean {
  // Already surfaced by executeMutation's onError — see the contract note above.
  if (!result) return false;
  if (classifyCreateResult(result) !== 'rejected') {
    return false;
  }
  alertService.alert(t('labels.error'), rejectionMessage(result, message));
  return true;
}
