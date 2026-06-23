import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
  getPantryItemDuplicateFromResult,
} from '../pantryItemDuplicate';

const CODE = 'PANTRY_ITEM_ALREADY_EXISTS';

const makeCombinedError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  errors: [{ extensions: { code, ...extensions }, message: 'Duplicate' }],
});

const makeLegacyError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  graphQLErrors: [
    { extensions: { code, ...extensions }, message: 'Duplicate' },
  ],
});

const makeSingleError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  extensions: { code, ...extensions },
});

describe('pantryItemDuplicate', () => {
  describe('isPantryItemDuplicateError', () => {
    it('detects in CombinedGraphQLErrors (.errors)', () => {
      expect(isPantryItemDuplicateError(makeCombinedError(CODE))).toBe(true);
    });

    it('detects in legacy ApolloError (.graphQLErrors)', () => {
      expect(isPantryItemDuplicateError(makeLegacyError(CODE))).toBe(true);
    });

    it('detects in single error with extensions', () => {
      expect(isPantryItemDuplicateError(makeSingleError(CODE))).toBe(true);
    });

    it('returns false for other error codes', () => {
      expect(isPantryItemDuplicateError(makeCombinedError('NOT_FOUND'))).toBe(
        false,
      );
    });

    it('returns false for null', () => {
      expect(isPantryItemDuplicateError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isPantryItemDuplicateError(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isPantryItemDuplicateError('string error')).toBe(false);
    });

    it('returns false for object without errors/extensions', () => {
      expect(isPantryItemDuplicateError({ message: 'error' })).toBe(false);
    });
  });

  describe('getPantryItemDuplicateInfo', () => {
    it('extracts single ID from CombinedGraphQLErrors', () => {
      const error = makeCombinedError(CODE, {
        existingPantryItemId: 'item-1',
      });
      const info = getPantryItemDuplicateInfo(error);
      expect(info).toEqual({
        existingPantryItemId: 'item-1',
        existingPantryItemIds: ['item-1'],
      });
    });

    it('extracts array of IDs when provided', () => {
      const error = makeLegacyError(CODE, {
        existingPantryItemId: 'item-1',
        existingPantryItemIds: ['item-1', 'item-2'],
      });
      const info = getPantryItemDuplicateInfo(error);
      expect(info).toEqual({
        existingPantryItemId: 'item-1',
        existingPantryItemIds: ['item-1', 'item-2'],
      });
    });

    it('extracts from single error with extensions', () => {
      const error = makeSingleError(CODE, {
        existingPantryItemId: 'item-1',
      });
      const info = getPantryItemDuplicateInfo(error);
      expect(info?.existingPantryItemId).toBe('item-1');
    });

    it('returns null for non-duplicate error', () => {
      expect(
        getPantryItemDuplicateInfo(makeCombinedError('NOT_FOUND')),
      ).toBeNull();
    });

    it('returns null when existingPantryItemId is missing', () => {
      const error = makeCombinedError(CODE);
      expect(getPantryItemDuplicateInfo(error)).toBeNull();
    });

    it('returns null for null input', () => {
      expect(getPantryItemDuplicateInfo(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(getPantryItemDuplicateInfo(undefined)).toBeNull();
    });
  });

  describe('getPantryItemDuplicateFromResult', () => {
    it('reads the typed DuplicatePantryItemError union member from data', () => {
      const info = getPantryItemDuplicateFromResult(
        {
          __typename: 'DuplicatePantryItemError',
          existingPantryItemIds: ['existing-1', 'existing-2'],
        },
        undefined,
      );
      expect(info).toEqual({
        existingPantryItemId: 'existing-1',
        existingPantryItemIds: ['existing-1', 'existing-2'],
      });
    });

    it('falls back to the legacy PANTRY_ITEM_ALREADY_EXISTS GraphQL error', () => {
      const info = getPantryItemDuplicateFromResult(
        { __typename: 'CreatePantryItemPayload' },
        makeCombinedError(CODE, { existingPantryItemId: 'item-1' }),
      );
      expect(info).toEqual({
        existingPantryItemId: 'item-1',
        existingPantryItemIds: ['item-1'],
      });
    });

    it('returns null for a successful payload with no error', () => {
      expect(
        getPantryItemDuplicateFromResult(
          { __typename: 'CreatePantryItemPayload' },
          undefined,
        ),
      ).toBeNull();
    });

    it('returns null when the duplicate member carries no ids', () => {
      expect(
        getPantryItemDuplicateFromResult(
          { __typename: 'DuplicatePantryItemError', existingPantryItemIds: [] },
          undefined,
        ),
      ).toBeNull();
    });
  });
});
