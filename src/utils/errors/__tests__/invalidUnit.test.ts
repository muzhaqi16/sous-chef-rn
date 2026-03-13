import {
  isInvalidUnitError,
  isInvalidUnitPayload,
  getValidUnits,
  getInvalidUnitMessage,
  handleInvalidUnit,
} from '../invalidUnit';

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

  describe('getValidUnits', () => {
    it('extracts validUnits array from graphQLErrors', () => {
      const error = makeApolloError('UNIT_INVALID', {
        validUnits: ['g', 'kg', 'oz'],
      });
      expect(getValidUnits(error)).toEqual(['g', 'kg', 'oz']);
    });

    it('extracts validUnits from direct extensions', () => {
      const error = makeSingleError('UNIT_INVALID', {
        validUnits: ['ml', 'L', 'cup'],
      });
      expect(getValidUnits(error)).toEqual(['ml', 'L', 'cup']);
    });

    it('returns null when no validUnits field', () => {
      const error = makeApolloError('UNIT_INVALID');
      expect(getValidUnits(error)).toBeNull();
    });

    it('returns null for non-INVALID_UNIT errors', () => {
      const error = makeApolloError('NOT_FOUND', {
        validUnits: ['g', 'kg'],
      });
      expect(getValidUnits(error)).toBeNull();
    });

    it('returns null when validUnits is not an array', () => {
      const error = makeApolloError('UNIT_INVALID', {
        validUnits: 'not-an-array',
      });
      expect(getValidUnits(error)).toBeNull();
    });
  });

  describe('getInvalidUnitMessage', () => {
    it('extracts message from graphQLErrors', () => {
      const error = makeApolloError('UNIT_INVALID');
      expect(getInvalidUnitMessage(error)).toBe(
        'The unit "bushel" is not valid for this operation',
      );
    });

    it('extracts message from direct extensions', () => {
      const error = makeSingleError(
        'UNIT_INVALID',
        {},
        'Custom invalid unit message',
      );
      expect(getInvalidUnitMessage(error)).toBe('Custom invalid unit message');
    });

    it('returns default message when no message is present', () => {
      const error = {
        graphQLErrors: [{ extensions: { code: 'UNIT_INVALID' } }],
      };
      expect(getInvalidUnitMessage(error)).toBe(
        'This unit is not available for this operation. Please select a different unit.',
      );
    });

    it('returns default message for non-INVALID_UNIT errors', () => {
      const error = makeApolloError('NOT_FOUND');
      expect(getInvalidUnitMessage(error)).toBe(
        'This unit is not available for this operation. Please select a different unit.',
      );
    });
  });

  describe('handleInvalidUnit', () => {
    it('returns true and logs for invalid unit errors', () => {
      const error = makeApolloError('UNIT_INVALID', {
        validUnits: ['g', 'kg', 'oz'],
      });
      expect(handleInvalidUnit(error)).toBe(true);
      expect(console.warn).toHaveBeenCalled();
    });

    it('returns false for non-INVALID_UNIT errors', () => {
      expect(handleInvalidUnit(makeApolloError('NOT_FOUND'))).toBe(false);
    });
  });

  describe('isInvalidUnitPayload', () => {
    it('returns true for payload with UNIT_INVALID code and success false', () => {
      expect(
        isInvalidUnitPayload({ success: false, code: 'UNIT_INVALID' }),
      ).toBe(true);
    });

    it('returns false for successful payload with UNIT_INVALID code', () => {
      expect(
        isInvalidUnitPayload({ success: true, code: 'UNIT_INVALID' }),
      ).toBe(false);
    });

    it('returns false for failed payload with different code', () => {
      expect(
        isInvalidUnitPayload({ success: false, code: 'VALIDATION_ERROR' }),
      ).toBe(false);
    });
  });
});
