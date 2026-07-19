import {
  isVersionConflictError,
  isVersionConflictPayload,
  getVersionConflictDetails,
  getVersionConflictMessage,
  handleVersionConflict,
  findFirstErrorMember,
  findConflictDataMember,
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
      expect(isVersionConflictError(makeApolloError('CONFLICT'))).toBe(true);
    });

    it('detects VERSION_CONFLICT in extensions', () => {
      expect(isVersionConflictError(makeSingleError('CONFLICT'))).toBe(true);
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

  describe('getVersionConflictDetails', () => {
    it('extracts details from graphQLErrors', () => {
      const error = makeApolloError('CONFLICT', {
        resourceType: 'PantryItem',
        currentVersion: 3,
        expectedVersion: 2,
      });
      expect(getVersionConflictDetails(error)).toEqual({
        resourceType: 'PantryItem',
        currentVersion: 3,
        expectedVersion: 2,
      });
    });

    it('extracts details from single error extensions', () => {
      const error = makeSingleError('CONFLICT', {
        resourceType: 'ShoppingList',
        currentVersion: 5,
        expectedVersion: 4,
      });
      expect(getVersionConflictDetails(error)).toEqual({
        resourceType: 'ShoppingList',
        currentVersion: 5,
        expectedVersion: 4,
      });
    });

    it('returns null for non-version-conflict error', () => {
      expect(
        getVersionConflictDetails(makeApolloError('NOT_FOUND')),
      ).toBeNull();
    });

    it('returns null when version fields are wrong types', () => {
      const error = makeApolloError('CONFLICT', {
        resourceType: 123,
        currentVersion: 'bad',
        expectedVersion: 'bad',
      });
      expect(getVersionConflictDetails(error)).toBeNull();
    });

    it('returns null when extensions missing version fields', () => {
      const error = makeApolloError('CONFLICT');
      expect(getVersionConflictDetails(error)).toBeNull();
    });
  });

  describe('getVersionConflictMessage', () => {
    it('includes resource type in message', () => {
      const error = makeApolloError('CONFLICT', {
        resourceType: 'PantryItem',
        currentVersion: 3,
        expectedVersion: 2,
      });
      expect(getVersionConflictMessage(error)).toContain('pantryitem');
    });

    it('returns generic message when no details', () => {
      const error = makeApolloError('CONFLICT');
      expect(getVersionConflictMessage(error)).toContain(
        'This item was updated',
      );
    });

    it('returns generic message for non-version-conflict error', () => {
      expect(getVersionConflictMessage(makeApolloError('NOT_FOUND'))).toContain(
        'This item was updated',
      );
    });
  });

  describe('handleVersionConflict', () => {
    it('returns true for version conflict errors', () => {
      const error = makeApolloError('CONFLICT', {
        resourceType: 'PantryItem',
        currentVersion: 3,
        expectedVersion: 2,
      });
      expect(handleVersionConflict(error)).toBe(true);
      expect(console.warn).toHaveBeenCalled();
    });

    it('returns false for non-version-conflict errors', () => {
      expect(handleVersionConflict(makeApolloError('NOT_FOUND'))).toBe(false);
    });
  });

  describe('isVersionConflictPayload', () => {
    it('returns true for payload with CONFLICT code and success false', () => {
      expect(
        isVersionConflictPayload({ success: false, code: 'CONFLICT' }),
      ).toBe(true);
    });

    it('returns false for successful payload with CONFLICT code', () => {
      expect(
        isVersionConflictPayload({ success: true, code: 'CONFLICT' }),
      ).toBe(false);
    });

    it('returns false for failed payload with different code', () => {
      expect(
        isVersionConflictPayload({ success: false, code: 'NOT_FOUND' }),
      ).toBe(false);
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
