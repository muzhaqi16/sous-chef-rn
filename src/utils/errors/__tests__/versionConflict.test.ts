import {
  isVersionConflictError,
  isVersionConflictPayload,
  getVersionConflictMessage,
  handleVersionConflict,
  findFirstErrorMember,
  findConflictDataMember,
} from '../versionConflict';
import { logger } from '#/utils/environment';

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
    it('detects CONFLICT in graphQLErrors', () => {
      expect(isVersionConflictError(makeApolloError('CONFLICT'))).toBe(true);
    });

    it('detects VERSION_CONFLICT in graphQLErrors', () => {
      expect(isVersionConflictError(makeApolloError('VERSION_CONFLICT'))).toBe(
        true,
      );
    });

    it('detects CONFLICT in extensions', () => {
      expect(isVersionConflictError(makeSingleError('CONFLICT'))).toBe(true);
    });

    it('detects VERSION_CONFLICT in extensions', () => {
      expect(isVersionConflictError(makeSingleError('VERSION_CONFLICT'))).toBe(
        true,
      );
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

  describe('handleVersionConflict', () => {
    it('returns true for version conflict errors', () => {
      expect(handleVersionConflict(makeApolloError('CONFLICT'))).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('returns true for VERSION_CONFLICT errors', () => {
      expect(handleVersionConflict(makeApolloError('VERSION_CONFLICT'))).toBe(
        true,
      );
    });

    it('returns false for non-version-conflict errors', () => {
      expect(handleVersionConflict(makeApolloError('NOT_FOUND'))).toBe(false);
    });
  });

  describe('isVersionConflictPayload', () => {
    it('returns true for the CONFLICT code', () => {
      expect(isVersionConflictPayload('CONFLICT')).toBe(true);
    });

    it('returns true for the VERSION_CONFLICT code (optimistic-lock failures)', () => {
      expect(isVersionConflictPayload('VERSION_CONFLICT')).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(isVersionConflictPayload('NOT_FOUND')).toBe(false);
      expect(isVersionConflictPayload('IDEMPOTENT_REPLAY')).toBe(false);
    });
  });

  describe('findFirstErrorMember', () => {
    it('returns the error member typename, code, and message', () => {
      expect(
        findFirstErrorMember({
          updateItem: {
            __typename: 'ValidationError',
            code: 'INVALID',
            message: 'Name is required',
          },
        }),
      ).toEqual({
        typename: 'ValidationError',
        code: 'INVALID',
        message: 'Name is required',
      });
    });

    it('reports null code and message when the member lacks them', () => {
      expect(
        findFirstErrorMember({ deletePantry: { __typename: 'NotFoundError' } }),
      ).toEqual({ typename: 'NotFoundError', code: null, message: null });
    });

    it('returns null for a success payload with no error member', () => {
      expect(
        findFirstErrorMember({
          updateItem: { __typename: 'UpdateItemPayload', id: '1' },
        }),
      ).toBeNull();
    });

    it('returns null for non-object data', () => {
      expect(findFirstErrorMember(null)).toBeNull();
      expect(findFirstErrorMember(undefined)).toBeNull();
      expect(findFirstErrorMember('nope')).toBeNull();
    });
  });

  describe('findConflictDataMember', () => {
    it('detects a ConflictError member by typename', () => {
      expect(
        findConflictDataMember({
          updateItem: { __typename: 'ConflictError', message: 'Stale' },
        }),
      ).toEqual({ message: 'Stale' });
    });

    it('detects a coded conflict on another error typename', () => {
      expect(
        findConflictDataMember({
          updateItem: {
            __typename: 'MutationError',
            code: 'VERSION_CONFLICT',
            message: null,
          },
        }),
      ).toEqual({ message: null });
    });

    it('returns null for a non-conflict error member', () => {
      expect(
        findConflictDataMember({
          updateItem: { __typename: 'ValidationError', code: 'INVALID' },
        }),
      ).toBeNull();
    });
  });
});
