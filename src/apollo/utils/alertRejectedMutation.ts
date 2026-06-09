import { alertService } from '#/services/alertService';

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
 * Call only on the `'rejected'` branch, and only from hooks whose `onError`
 * already handles the transport-error case: this alerts solely when there is no
 * `error`, so it never double-alerts.
 */
export function alertRejectedMutation(
  result: { error?: unknown } | null | undefined,
  message: string,
): void {
  if (!result?.error) {
    alertService.alert('Error', message);
  }
}
