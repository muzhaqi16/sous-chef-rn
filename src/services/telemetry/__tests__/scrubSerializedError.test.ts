import { scrubLogExtra } from '#/services/telemetry/scrub';
import { serializeError } from '#utils/errorSerialization';

/**
 * The redaction layer matches on object KEYS, so it only sees a key that is
 * still a key. A caller that serializes an error to a string first hands it one
 * opaque value, and `password` inside that string survives every key rule.
 */
describe('scrubbing a serialized error', () => {
  const apolloShapedError = {
    message: 'Response not successful: Received status code 400',
    operation: {
      operationName: 'LoginUser',
      variables: { email: 'someone@example.com', password: 'hunter2-correct' },
    },
    networkError: {
      name: 'ServerError',
      message: 'Bad Request',
      statusCode: 400,
      result: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig' },
    },
  };

  it('removes a password carried in operation variables', () => {
    const scrubbed = scrubLogExtra({
      serialized_error: serializeError(apolloShapedError),
    });

    expect(JSON.stringify(scrubbed)).not.toContain('hunter2-correct');
  });

  it('removes an email carried in operation variables', () => {
    const scrubbed = scrubLogExtra({
      serialized_error: serializeError(apolloShapedError),
    });

    expect(JSON.stringify(scrubbed)).not.toContain('someone@example.com');
  });

  it('removes a token carried in a network-error result', () => {
    const scrubbed = scrubLogExtra({
      serialized_error: serializeError(apolloShapedError),
    });

    expect(JSON.stringify(scrubbed)).not.toContain('hunter2-correct');
    expect(JSON.stringify(scrubbed)).not.toContain('.payload.sig');
  });

  it('keeps the fields that make the error attributable', () => {
    const scrubbed = scrubLogExtra({
      serialized_error: serializeError(apolloShapedError),
    }) as { serialized_error: Record<string, unknown> };

    expect(scrubbed.serialized_error.message).toContain('status code 400');
    expect(
      (scrubbed.serialized_error.operation as { operationName: string })
        .operationName,
    ).toBe('LoginUser');
  });

  it('cannot redact the same password once the error is a string', () => {
    const asString = JSON.stringify(serializeError(apolloShapedError));
    const scrubbed = scrubLogExtra({ serialized_error: asString });

    // Pins why the object is passed: the key rules have no keys to match here,
    // and only the value patterns (email, long token) still apply.
    expect(JSON.stringify(scrubbed)).toContain('hunter2-correct');
  });
});
