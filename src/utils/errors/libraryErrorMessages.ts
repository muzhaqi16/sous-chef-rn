/**
 * The one module that reads an error's message text. Each predicate covers a
 * library that puts its signal in the message and nowhere else; everything
 * outside branches on an error's class, `name` or `code`. `sous-chef/no-error-
 * message-branching` exempts this file alone.
 */

interface MessageBearer {
  message?: string;
}

/**
 * Apollo's `GraphQLWsLink` turns a socket close into
 * `Socket closed with event <code> <reason>`, and a failure with no CloseEvent
 * (DNS, TCP) into the bare `Socket closed`. The close code exists only there.
 */
const SOCKET_CLOSED = /^Socket closed(?: with event (\d+))?/;

/** The close the socket ended with: `{}` for a failure with no CloseEvent, null otherwise. */
export function socketCloseOf(
  error: MessageBearer | null | undefined,
): { code?: number } | null {
  const match = SOCKET_CLOSED.exec(error?.message ?? '');
  if (!match) return null;
  return match[1] === undefined ? {} : { code: Number(match[1]) };
}

/**
 * graphql-armor refuses an over-deep or over-costly document with a plain
 * `GraphQLError` ("Syntax Error: Query depth limit of 5 exceeded, found 8.") and
 * no code of its own, so the server formats it under whatever code applies.
 */
const ARMOR_REJECTION =
  /(depth|cost) limit of \d+ exceeded|query validation error/i;

export const isArmorRejection = (error: MessageBearer | null | undefined) =>
  ARMOR_REJECTION.test(error?.message ?? '');

/** graphql-js `subscribe` when a subscription resolver returns no event stream. */
export const isNonIterableSubscriptionResolver = (
  error: MessageBearer | null | undefined,
) =>
  (error?.message ?? '').includes(
    'Subscription field must return Async Iterable',
  );

/**
 * androidx DataStore throws an `IllegalStateException` when a second instance
 * opens the same file; react-native-keychain rejects with it under a generic
 * code, so only the message tells contention apart from a real keystore fault.
 */
export const isDataStoreContention = (error: unknown) =>
  error instanceof Error &&
  error.message.includes('multiple DataStores active');

const INVALIDATED =
  /Key\s*Permanently\s*Invalidated|BiometryCurrentSet|changed or deleted their auth/i;

// react-native-keychain rejects every `CryptoFailedException` as
// `E_CRYPTO_FAILED`, and its biometric handler builds one for EVERY androidx
// outcome — a cancel included — formatted `code: <n>, msg: …`. Only the prompt
// callback writes that marker, so it means authentication ended without
// succeeding, which is never the same thing as an unusable key.
const PROMPT_OUTCOME = /(?:^|\s)code:\s*\d+/;

// The Android bridge spreads one rejection across `code`, `name` and
// `message`; join them so the signal is read wherever it landed.
function rejectionText(error: unknown): string {
  if (error === null || typeof error !== 'object') return String(error);
  return [
    'code' in error ? error.code : undefined,
    'name' in error ? error.name : undefined,
    'message' in error ? error.message : undefined,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
}

/**
 * react-native-keychain on Android: a `BIOMETRY_CURRENT_SET` key whose
 * enrolment changed is permanently invalidated and must be re-enrolled. It
 * rejects under the generic `E_CRYPTO_FAILED`, so only the text says which.
 */
export function isKeychainKeyInvalidated(error: unknown): boolean {
  const text = rejectionText(error);
  if (PROMPT_OUTCOME.test(text)) return false;
  return INVALIDATED.test(text);
}
