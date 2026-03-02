import {
  serializeError,
  isCircularStructureError,
  isTimerCircularStructureError,
  safeStringifyError,
} from '../errorSerialization';

describe('errorSerialization', () => {
  describe('serializeError', () => {
    it('handles falsy input', () => {
      expect(serializeError(null)).toEqual({ message: 'Unknown error' });
      expect(serializeError(undefined)).toEqual({ message: 'Unknown error' });
      expect(serializeError(0)).toEqual({ message: 'Unknown error' });
    });

    it('handles string input', () => {
      expect(serializeError('Something failed')).toEqual({ message: 'Something failed' });
    });

    it('serializes a basic Error', () => {
      const error = new Error('Test error');
      const result = serializeError(error);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('Test error');
      expect(result.stack).toBeDefined();
    });

    it('includes error code when present', () => {
      const error = Object.assign(new Error('err'), { code: 'ERR_001' });
      expect(serializeError(error).code).toBe('ERR_001');
    });

    it('serializes graphQLErrors', () => {
      const error = {
        name: 'ApolloError',
        message: 'GraphQL error',
        graphQLErrors: [
          {
            message: 'Not found',
            path: ['query', 'user'],
            extensions: { code: 'NOT_FOUND' },
          },
        ],
      };
      const result = serializeError(error);
      expect(result.graphQLErrors).toHaveLength(1);
      expect(result.graphQLErrors[0].message).toBe('Not found');
      expect(result.graphQLErrors[0].path).toEqual(['query', 'user']);
      expect(result.graphQLErrors[0].extensions).toEqual({ code: 'NOT_FOUND' });
    });

    it('serializes networkError', () => {
      const error = {
        message: 'Network error',
        networkError: {
          name: 'ServerError',
          message: 'Internal Server Error',
          statusCode: 500,
          result: { error: 'Server error' },
        },
      };
      const result = serializeError(error);
      expect(result.networkError.name).toBe('ServerError');
      expect(result.networkError.statusCode).toBe(500);
    });

    it('serializes operation info', () => {
      const error = {
        message: 'Error',
        operation: {
          operationName: 'GetUser',
          variables: { id: '123' },
        },
      };
      const result = serializeError(error);
      expect(result.operation.operationName).toBe('GetUser');
      expect(result.operation.variables).toEqual({ id: '123' });
    });

    it('serializes extraInfo', () => {
      const error = {
        message: 'Error',
        extraInfo: { context: 'login', attempt: 3 },
      };
      const result = serializeError(error);
      expect(result.extraInfo).toEqual({ context: 'login', attempt: 3 });
    });

    it('handles circular references', () => {
      const obj: Record<string, unknown> = { message: 'Error' };
      obj.self = obj;
      const result = serializeError(obj);
      expect(result.message).toBe('Error');
    });

    it('respects maxDepth', () => {
      const error = {
        message: 'Deep',
        extraInfo: { a: { b: { c: { d: { e: 'deep' } } } } },
      };
      const result = serializeError(error, 2);
      // At depth 2, nested values should be truncated
      expect(result.extraInfo).toBeDefined();
    });

    it('serializes Date objects as ISO strings', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const error = { message: 'Error', extraInfo: { created: date } };
      const result = serializeError(error);
      expect(result.extraInfo.created).toBe('2024-01-01T00:00:00.000Z');
    });

    it('serializes arrays in extraInfo', () => {
      const error = { message: 'Error', extraInfo: { items: [1, 2, 3] } };
      const result = serializeError(error);
      expect(result.extraInfo.items).toEqual([1, 2, 3]);
    });
  });

  describe('isCircularStructureError', () => {
    it('detects circular structure in error message', () => {
      const error = new Error('Converting circular structure to JSON');
      expect(isCircularStructureError(error)).toBe(true);
    });

    it('detects from string', () => {
      expect(isCircularStructureError('Converting circular structure to JSON')).toBe(true);
    });

    it('detects partial match', () => {
      expect(isCircularStructureError('circular structure detected')).toBe(true);
    });

    it('returns false for non-circular errors', () => {
      expect(isCircularStructureError(new Error('Regular error'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isCircularStructureError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isCircularStructureError(undefined)).toBe(false);
    });
  });

  describe('isTimerCircularStructureError', () => {
    it('detects timer circular structure error', () => {
      const error = new Error(
        'Converting circular structure to JSON\n --> starting at object Timeout',
      );
      expect(isTimerCircularStructureError(error)).toBe(true);
    });

    it('detects TimersList variant', () => {
      const error = new Error(
        'Converting circular structure to JSON\n --> TimersList reference',
      );
      expect(isTimerCircularStructureError(error)).toBe(true);
    });

    it('detects _idlePrev variant', () => {
      const error = new Error(
        'Converting circular structure to JSON _idlePrev',
      );
      expect(isTimerCircularStructureError(error)).toBe(true);
    });

    it('returns false for non-timer circular error', () => {
      const error = new Error('Converting circular structure to JSON');
      expect(isTimerCircularStructureError(error)).toBe(false);
    });

    it('returns false for regular errors', () => {
      expect(isTimerCircularStructureError(new Error('Regular'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTimerCircularStructureError(null)).toBe(false);
    });
  });

  describe('safeStringifyError', () => {
    it('stringifies a simple error', () => {
      const result = safeStringifyError({ key: 'value' });
      expect(result.isCircular).toBe(false);
      expect(result.stringified).toContain('key');
    });

    it('handles string input', () => {
      const result = safeStringifyError('plain string');
      expect(result.stringified).toBe('plain string');
      expect(result.isCircular).toBe(false);
    });

    it('handles error with circular structure message', () => {
      const error = new Error('Converting circular structure to JSON');
      const result = safeStringifyError(error);
      expect(result.isCircular).toBe(true);
      expect(result.stringified).toContain('[Circular structure detected]');
    });

    it('handles circular structure string', () => {
      const result = safeStringifyError('Converting circular structure to JSON');
      expect(result.isCircular).toBe(true);
    });

    it('handles array with circular errors', () => {
      const errors = [new Error('Converting circular structure to JSON')];
      const result = safeStringifyError(errors);
      expect(result.isCircular).toBe(true);
    });

    it('handles array with circular string', () => {
      const errors = ['Converting circular structure to JSON'];
      const result = safeStringifyError(errors);
      expect(result.isCircular).toBe(true);
      expect(result.message).toBe('Converting circular structure to JSON');
    });

    it('handles actual circular objects', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      const result = safeStringifyError(obj);
      expect(result.isCircular).toBe(true);
    });
  });
});
