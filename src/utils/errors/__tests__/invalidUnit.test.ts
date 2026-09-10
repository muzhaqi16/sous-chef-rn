import { isInvalidUnitError, isInvalidUnitPayload } from '../invalidUnit';

const makeApolloError = (
  code: string,
  extensions: Record<string, unknown> = {},
) => ({
  graphQLErrors: [
    {
      message: 'The unit "bushel" is not valid for this operation',
      extensions: { code, ...extensions },
    },
  ],
});

const makeSingleError = (
  code: string,
  extensions: Record<string, unknown> = {},
  message = 'The unit "bushel" is not valid for this operation',
) => ({
  message,
  extensions: { code, ...extensions },
});

describe('invalidUnit', () => {
  describe('isInvalidUnitError', () => {
    it('returns true for graphQLErrors with INVALID_UNIT code', () => {
      expect(isInvalidUnitError(makeApolloError('UNIT_INVALID'))).toBe(true);
    });

    it('returns true for direct extensions with INVALID_UNIT code', () => {
      expect(isInvalidUnitError(makeSingleError('UNIT_INVALID'))).toBe(true);
    });

    it('returns false for other error codes', () => {
      expect(isInvalidUnitError(makeApolloError('NOT_FOUND'))).toBe(false);
    });

    it('returns false for errors without extensions', () => {
      expect(isInvalidUnitError({ graphQLErrors: [{ message: 'err' }] })).toBe(
        false,
      );
    });

    it('returns false for plain objects without graphQLErrors or extensions', () => {
      expect(isInvalidUnitError({ message: 'something' })).toBe(false);
    });
  });

  describe('isInvalidUnitPayload', () => {
    it('returns true for the UNIT_INVALID code', () => {
      expect(isInvalidUnitPayload('UNIT_INVALID')).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(isInvalidUnitPayload('VALIDATION_ERROR')).toBe(false);
    });
  });
});
