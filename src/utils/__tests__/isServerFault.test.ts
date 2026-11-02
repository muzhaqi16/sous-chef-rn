import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { isGatewayFault, isServerFault } from '../isServerFault';

const answered = (status: number) =>
  new ServerError('HTTP', {
    response: new Response('', { status }),
    bodyText: '',
  });

describe('isServerFault', () => {
  it.each([500, 502, 503, 504, 507])('reads a %i as a fault', status => {
    expect(isServerFault(answered(status))).toBe(true);
  });

  it.each([400, 401, 404, 429])('leaves a %i to its own handling', status => {
    expect(isServerFault(answered(status))).toBe(false);
  });

  it('reads neither a failed request nor a GraphQL error as a fault', () => {
    expect(isServerFault(new NetworkRequestError('failed'))).toBe(false);
    expect(
      isServerFault(new CombinedGraphQLErrors({ errors: [{ message: 'x' }] })),
    ).toBe(false);
  });
});

describe('isGatewayFault', () => {
  it.each([502, 503, 504])('reads a %i as the API being away', status => {
    expect(isGatewayFault(answered(status))).toBe(true);
  });

  it('reads a 500 as one request breaking', () => {
    expect(isGatewayFault(answered(500))).toBe(false);
  });
});
