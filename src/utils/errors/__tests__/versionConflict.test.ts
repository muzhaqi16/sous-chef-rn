import {
  isVersionConflictError,
  getVersionConflictDetails,
  getVersionConflictMessage,
  handleVersionConflict,
} from '../versionConflict';

const makeApolloError = (code: string, extensions: Record<string, unknown> = {}) => ({
  graphQLErrors: [
    {
      message: 'Version conflict',
      extensions: { code, ...extensions },
    },
  ],
});

const makeSingleError = (code: string, extensions: Record<string, unknown> = {}) => ({
  extensions: { code, ...extensions },
});

describe('versionConflict', () => {
  describe('isVersionConflictError', () => {
    it('detects VERSION_CONFLICT in graphQLErrors', () => {
      expect(isVersionConflictError(makeApolloError('VERSION_CONFLICT'))).toBe(true);
    });

    it('detects VERSION_CONFLICT in extensions', () => {
      expect(isVersionConflictError(makeSingleError('VERSION_CONFLICT'))).toBe(true);
    });

    it('returns false for other error codes', () => {
      expect(isVersionConflictError(makeApolloError('NOT_FOUND'))).toBe(false);
    });

    it('returns false for errors without extensions', () => {
      expect(isVersionConflictError({ graphQLErrors: [{ message: 'err' }] })).toBe(false);
    });

    it('returns false for plain objects', () => {
      expect(isVersionConflictError({ message: 'something' })).toBe(false);
    });
  });

  describe('getVersionConflictDetails', () => {
    it('extracts details from graphQLErrors', () => {
      const error = makeApolloError('VERSION_CONFLICT', {
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
      const error = makeSingleError('VERSION_CONFLICT', {
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
      expect(getVersionConflictDetails(makeApolloError('NOT_FOUND'))).toBeNull();
    });

    it('returns null when version fields are wrong types', () => {
      const error = makeApolloError('VERSION_CONFLICT', {
        resourceType: 123,
        currentVersion: 'bad',
        expectedVersion: 'bad',
      });
      expect(getVersionConflictDetails(error)).toBeNull();
    });

    it('returns null when extensions missing version fields', () => {
      const error = makeApolloError('VERSION_CONFLICT');
      expect(getVersionConflictDetails(error)).toBeNull();
    });
  });

  describe('getVersionConflictMessage', () => {
    it('includes resource type in message', () => {
      const error = makeApolloError('VERSION_CONFLICT', {
        resourceType: 'PantryItem',
        currentVersion: 3,
        expectedVersion: 2,
      });
      expect(getVersionConflictMessage(error)).toContain('pantryitem');
    });

    it('returns generic message when no details', () => {
      const error = makeApolloError('VERSION_CONFLICT');
      expect(getVersionConflictMessage(error)).toContain('This item was updated');
    });

    it('returns generic message for non-version-conflict error', () => {
      expect(getVersionConflictMessage(makeApolloError('NOT_FOUND'))).toContain(
        'This item was updated',
      );
    });
  });

  describe('handleVersionConflict', () => {
    it('returns true for version conflict errors', () => {
      const error = makeApolloError('VERSION_CONFLICT', {
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
});
