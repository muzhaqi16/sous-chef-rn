import { serializeError, safeStringifyError } from '../errorSerialization';

describe('errorSerialization', () => {
  describe('serializeError', () => {
    it('names the falsy value it was given', () => {
      expect(serializeError(null)).toEqual({
        message: 'Unknown error (null)',
      });
      expect(serializeError(undefined)).toEqual({
        message: 'Unknown error (undefined)',
      });
      expect(serializeError(0)).toEqual({ message: 'Unknown error (0)' });
      expect(serializeError('')).toEqual({
        message: 'Unknown error (empty string)',
      });
      expect(serializeError(false)).toEqual({
        message: 'Unknown error (false)',
      });
    });

    it('handles string input', () => {
      expect(serializeError('Something failed')).toEqual({
        message: 'Something failed',
      });
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
      expect(result.graphQLErrors?.[0]!.message).toBe('Not found');
      expect(result.graphQLErrors?.[0]!.path).toEqual(['query', 'user']);
      expect(result.graphQLErrors?.[0]!.extensions).toEqual({
        code: 'NOT_FOUND',
      });
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
      expect(result.networkError?.name).toBe('ServerError');
      expect(result.networkError?.statusCode).toBe(500);
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
      expect(result.operation?.operationName).toBe('GetUser');
      expect(result.operation?.variables).toEqual({ id: '123' });
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
      const extraInfo = result.extraInfo as { created: string };
      expect(extraInfo.created).toBe('2024-01-01T00:00:00.000Z');
    });

    it('serializes arrays in extraInfo', () => {
      const error = { message: 'Error', extraInfo: { items: [1, 2, 3] } };
      const result = serializeError(error);
      const extraInfo = result.extraInfo as { items: number[] };
      expect(extraInfo.items).toEqual([1, 2, 3]);
    });

    describe('message-less errors', () => {
      it('names an Error subclass with an empty message', () => {
        class CameraRuntimeError extends Error {}
        const error = new CameraRuntimeError('');
        error.name = 'CameraRuntimeError';
        const result = serializeError(error);
        expect(result.message).toMatch(/^Unknown error \(CameraRuntimeError/);
      });

      it('lists own properties of a message-less plain object', () => {
        const result = serializeError({ code: 'E_TIMEOUT', domain: 'camera' });
        expect(result.message).toBe('Unknown error (props: code, domain)');
        expect(result.code).toBe('E_TIMEOUT');
      });
    });
  });

  describe('safeStringifyError', () => {
    it('stringifies a simple error', () => {
      const result = safeStringifyError({ key: 'value' });
      expect(result.isCircular).toBe(false);
      expect(result.stringified).toBe(
        JSON.stringify({ key: 'value' }, null, 2),
      );
    });

    it('handles string input', () => {
      const result = safeStringifyError('plain string');
      expect(result.stringified).toBe('plain string');
      expect(result.isCircular).toBe(false);
    });

    it('stringifies a message that merely mentions a circular structure', () => {
      const result = safeStringifyError({
        message: 'Converting circular structure to JSON',
      });
      expect(result.isCircular).toBe(false);
      expect(result.stringified).toContain('Converting circular structure');
    });

    it('reports an actual circular object with its message', () => {
      const obj: Record<string, unknown> = { message: 'Socket failed' };
      obj.self = obj;
      const result = safeStringifyError(obj);
      expect(result).toEqual({
        stringified: '[Circular structure detected] Socket failed',
        isCircular: true,
        message: 'Socket failed',
      });
    });

    it('takes the message from the array entry that holds the cycle', () => {
      const detail: Record<string, unknown> = {};
      const cyclic = Object.assign(new Error('Second'), { detail });
      detail.back = cyclic;
      const result = safeStringifyError([{ message: 'First' }, cyclic]);
      expect(result.isCircular).toBe(true);
      expect(result.message).toBe('Second');
    });

    it('falls back when the cyclic value carries no message', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      expect(safeStringifyError(obj).message).toBe('Unknown error');
    });

    it('reports a non-cycle stringify failure without calling it circular', () => {
      const result = safeStringifyError({ big: BigInt(1) });
      expect(result.isCircular).toBe(false);
      expect(result.stringified).toMatch(/^\[Error serializing: .+\]$/);
    });
  });
});
