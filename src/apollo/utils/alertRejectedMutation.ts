import { alertService } from '#/services/alertService';
import { classifyCreateResult } from './classifyCreateResult';
import { t } from '#/i18n/t';

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
  result: { error?: unknown } | null | undefined,
  message: string,
): void {
  if (!result?.error) {
    alertService.alert(t('labels.error'), message);
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
 */
export function alertIfRejected(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
  message: string,
): boolean {
  if (!result) return false;
  if (classifyCreateResult(result) !== 'rejected') {
    return false;
  }
  alertService.alert(t('labels.error'), message);
  return true;
}
