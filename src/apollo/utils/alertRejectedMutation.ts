import { alertService } from '#/services/alertService';
import { classifyCreateResult } from './classifyCreateResult';
import { validationFieldName } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

/**
 * Copy for a refusal: a `ValidationError`'s field selects `errors.field.*`, else
 * the caller's fallback. The server's `message` is never shown — it is
 * unlocalizable English. Unlike {@link localizedRefusalMessage} this does NOT
 * fall through to `code`: an alert's caller already names the failed operation.
 */
const rejectionMessage = (result: { data?: unknown }, fallback: string) => {
  const field = validationFieldName(result.data);
  if (!field) return fallback;
  // i18next resolves defaultValue, so an unmapped field never renders a raw key.
  return t(`errors.field.${field}`, { defaultValue: fallback });
};

/**
 * The same resolution for a refusal PAYLOAD held directly: field, then code, then
 * the caller's fallback. The payload's `message` is never a candidate.
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
 * Alert on a `'rejected'` result: a non-success union payload resolves with HTTP
 * 200 and no `error`, so the mutation's `onError` never fires. Alerts ONLY when
 * there is no `error`, so a caller keeping its own `onError` cannot double-alert.
 * A site without one uses {@link alertIfRejected}; mixing them goes silent.
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
 * Alert on a rejection and return `true`. Rejection covers a resolved `*Error`
 * member AND a resolved transport error, alerted UNCONDITIONALLY — for sites with
 * no mutation `onError`. A falsy result returns `false` where
 * {@link classifyCreateResult} returns `'rejected'`: a throw was already reported.
 */
export function alertIfRejected(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
  message: string,
): boolean {
  // Already surfaced by executeMutation's onError.
  if (!result) return false;
  if (classifyCreateResult(result) !== 'rejected') {
    return false;
  }
  alertService.alert(t('labels.error'), rejectionMessage(result, message));
  return true;
}
