import { mergedLocale } from '#/test-utils/mergedLocales';
import { ErrorCode, TopLevelErrorCode } from '#graphql/generated/schemaTypes';
import { errorService } from '#services/errorService';

/**
 * Every error code the schema declares resolves to localized copy.
 *
 * `ERROR_MESSAGE_KEY_SUFFIXES` is typed by the generated enums, so a code
 * without an entry, or an entry for a code the API cannot send, fails the
 * typecheck. This holds the other half: each entry's key names copy that
 * exists, so no code a user can meet falls through to "an unexpected error".
 */

const SCHEMA_CODES = [
  ...new Set([
    ...Object.values(ErrorCode),
    ...Object.values(TopLevelErrorCode),
  ]),
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
