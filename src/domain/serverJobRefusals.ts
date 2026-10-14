import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';

/*
 * How a refused ask for server work queued under a client-minted id (a receipt
 * parse, a recipe capture) is read: an answer that stands, a daily allowance to
 * wait out, an update the API wants, or nothing that stops a resend.
 */

const PASSING_CODES: readonly string[] = [
  TopLevelErrorCode.InternalServerError,
  TopLevelErrorCode.ServiceUnavailable,
  // The operation's own budget, a minute long: traffic, as a 429 is.
  TopLevelErrorCode.OperationRateLimited,
];

// A traffic limit on the connection says nothing about the work asked for. A request
// that timed out answers 503, which passes as every server fault does.
const PASSING_STATUSES: readonly number[] = [401, 429];

/**
 * Whether a failed ask is the API's answer on the work asked for, which stands. One
 * that never arrived, a server fault, a traffic limit and a session mid-refresh
 * are not: the same ask may well succeed when sent again.
 */
export function isVerdict(error: unknown): boolean {
  if (ServerError.is(error)) {
    return (
      error.statusCode < 500 && !PASSING_STATUSES.includes(error.statusCode)
    );
  }
  if (!CombinedGraphQLErrors.is(error)) return false;
  return error.errors.every(({ extensions }) => {
    const code = extensions?.code;
    return (
      typeof code === 'string' &&
      !PASSING_CODES.includes(code) &&
      !isAuthRefusalCode(code)
    );
  });
}

/**
 * Seconds until the daily allowance is back, when that is what refused the
 * ask. The API states it from execution, in the response's errors; a 429 is
 * the gate's traffic limit, which carries the same code and a wait of its own.
 */
export const dailyAllowanceWait = (error: unknown): number | null => {
  if (!CombinedGraphQLErrors.is(error)) return null;
  const refusal = error.errors.find(
    ({ extensions }) =>
      extensions?.code === TopLevelErrorCode.RateLimitExceeded,
  );
  const retryAfter = refusal?.extensions?.retryAfter;
  return typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : null;
};

/** The API wants this build updated before it answers. */
export const isUpgradeRequired = (error: unknown) =>
  CombinedGraphQLErrors.is(error) &&
  error.errors.some(
    ({ extensions }) =>
      extensions?.code === TopLevelErrorCode.ClientUpgradeRequired,
  );

/** The feature is off for this user: no resend changes that. */
export const isFeatureDisabled = (error: unknown) =>
  CombinedGraphQLErrors.is(error) &&
  error.errors.some(
    ({ extensions }) => extensions?.code === TopLevelErrorCode.FeatureDisabled,
  );

/** The feature needs a plan this user does not hold: no resend changes that. */
export const isPremiumRequired = (error: unknown) =>
  CombinedGraphQLErrors.is(error) &&
  error.errors.some(
    ({ extensions }) => extensions?.code === TopLevelErrorCode.PremiumRequired,
  );
