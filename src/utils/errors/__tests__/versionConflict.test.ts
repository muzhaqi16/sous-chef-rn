import {
  isVersionConflictError,
  getVersionConflictMessage,
} from '../versionConflict';

const makeApolloError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  graphQLErrors: [
    {
      message: 'Version conflict',
      extensions: { code, ...extensions },
    },
  ],
});

const makeSingleError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  extensions: { code, ...extensions },
});

describe('versionConflict', () => {
  describe('isVersionConflictError', () => {
    it('detects VERSION_CONFLICT in graphQLErrors', () => {
      expect(isVersionConflictError(makeApolloError('VERSION_CONFLICT'))).toBe(
        true,
      );
    });

    it('detects RESOURCE_VERSION_CONFLICT in extensions', () => {
      expect(
        isVersionConflictError(makeSingleError('RESOURCE_VERSION_CONFLICT')),
      ).toBe(true);
    });

    // A state refusal (already completed, already a member) is not a stale row.
    it('does not read CONFLICT as a version conflict', () => {
      expect(isVersionConflictError(makeApolloError('CONFLICT'))).toBe(false);
      expect(isVersionConflictError(makeSingleError('CONFLICT'))).toBe(false);
    });

    it('returns false for other error codes', () => {
      expect(isVersionConflictError(makeApolloError('NOT_FOUND'))).toBe(false);
    });

    it('returns false for errors without extensions', () => {
      expect(
        isVersionConflictError({ graphQLErrors: [{ message: 'err' }] }),
      ).toBe(false);
    });

    it('returns false for plain objects', () => {
      expect(isVersionConflictError({ message: 'something' })).toBe(false);
    });
  });

  describe('getVersionConflictMessage', () => {
    // The union member carries only `code` + `message` — the API drops the
    // version-number extensions in the union mapping, so the message is
    // always the generic "updated elsewhere" body (no error argument).
    it('returns the generic message', () => {
      expect(getVersionConflictMessage()).toContain('This item was updated');
    });
  });
});
