import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { OfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { TimeoutError } from '../errors/timeoutError';
import { isNetworkError } from '../isNetworkError';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';

describe('isNetworkError', () => {
  it.each([
    ['a fetch failure', new NetworkRequestError('Network request failed')],
    ['a fetch timeout', new NetworkRequestError('Network request timed out')],
    ['our own deadline', new TimeoutError('Request timeout after 10000ms')],
    ['a socket close', new Error('Socket closed with event 1006 ')],
    ['a socket failure with no close event', new Error('Socket closed')],
  ])('detects %s', (_label, error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  it('does not read a TypeError from a bug as a network failure', () => {
    // Only the HTTP link's fetch boundary turns a TypeError into the network.
    expect(
      isNetworkError(new TypeError("Cannot read property 'id' of undefined")),
    ).toBe(false);
  });

  it('does not read a cancellation as a network failure', () => {
    // whatwg-fetch rejects an aborted request with a DOMException, not a TypeError.
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(isNetworkError(abort)).toBe(false);
  });

  it('does not read network words in a server refusal', () => {
    const refusal = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Connection to the upstream timed out; you appear offline',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        },
      ],
    });
    expect(isNetworkError(refusal)).toBe(false);
    expect(isNetworkError(new Error('Network timeout, device offline'))).toBe(
      false,
    );
  });

  it('does not read a non-2xx response as a network failure', () => {
    const error = new ServerError('Service Unavailable', {
      response: new Response('', { status: 503 }),
      bodyText: '',
    });
    expect(isNetworkError(error)).toBe(false);
  });

  it('does not read an offline rejection, which never touched the wire', () => {
    expect(isNetworkError(new OfflineRejectedError('UpdateThing'))).toBe(false);
  });

  it.each([null, undefined])('returns false for %p', value => {
    expect(isNetworkError(value)).toBe(false);
  });
});
