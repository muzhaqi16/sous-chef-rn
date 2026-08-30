import { mergedLocale } from '#/test-utils/mergedLocales';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

/**
 * Every error code the schema declares resolves to localized copy.
 *
 * `getUserFriendlyMessage` looks the code up in `ERROR_MESSAGE_KEY_SUFFIXES`
 * and, finding nothing, falls through to `errors.codes.unexpected`. The table
 * was hand-maintained against a generated enum, so six members of `ErrorCode`
 * and thirteen of `TopLevelErrorCode` had no entry: a user who hit a not-found,
 * a version conflict, a quota or a duplicate read "An unexpected error
 * occurred" — while localized copy for `resourceNotFound`, `resourceConflict`,
 * `quotaExceeded` and `pantryItemAlreadyExists` was already shipping,
 * unreachable.
 *
 * The check runs in ONE direction on purpose. The table is deliberately wider
 * than the SDL: `NETWORK_ERROR`, `CIRCUIT_OPEN`, the `BUSINESS_*` and
 * `RATE_LIMIT_*` families and the client's own `SERVICE_TIMEOUT` are raised on
 * this side and have no SDL to be declared in. An extra entry costs nothing; a
 * missing one is a sentence the user cannot read.
 */

const SCHEMA_CODES = [
  ...new Set([...Object.values(ErrorCode), ...Object.values(TopLevelErrorCode)]),
].sort();

describe('every schema error code has localized copy', () => {
  const en = mergedLocale('en') as {
    errors: { codes: Record<string, string> };
  };

  it('the enums are actually populated', () => {
    // A guard on the guard: an import that resolved to an empty object would
    // otherwise make this suite pass by testing nothing.
    expect(SCHEMA_CODES.length).toBeGreaterThan(20);
  });

  it.each(SCHEMA_CODES.map(code => [code]))('%s resolves', code => {
    const message = errorService.getUserFriendlyMessage(code);

    expect(message).not.toBe(en.errors.codes.unexpected);
    expect(message).toBeTruthy();
  });

  it('every mapped suffix names a real string', () => {
    // The other half: an entry pointing at a key that does not exist renders
    // the raw dot-path.
    const missing = SCHEMA_CODES.filter(code => {
      const message = errorService.getUserFriendlyMessage(code);
      return message.startsWith('errors.codes.');
    });

    expect(missing).toEqual([]);
  });
});
