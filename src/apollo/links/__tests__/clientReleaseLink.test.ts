jest.mock('../../clientUpgradeNotice', () => ({
  announceClientReleaseAvailable: jest.fn(),
}));

import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { Observable } from 'rxjs';
import { createClientReleaseLink } from '../clientReleaseLink';
import { announceClientReleaseAvailable } from '../../clientUpgradeNotice';

const announce = announceClientReleaseAvailable as jest.Mock;

const query = gql`
  query TestOp {
    me {
      id
    }
  }
`;

// ApolloLink.execute needs a client on its context; the canned link below
// terminates the chain, so this one never reaches the network.
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.empty(),
  defaultOptions: APOLLO_DEFAULT_OPTIONS,
});

/**
 * Drives one operation through the link with a canned downstream result and
 * returns what the subscriber saw, so the pass-through is asserted alongside
 * the side effect.
 */
const run = (extensions?: Record<string, unknown>): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const downstream = new ApolloLink(
      () =>
        new Observable(observer => {
          observer.next({ data: { me: { id: '1' } }, extensions });
          observer.complete();
        }),
    );

    let received: unknown;
    ApolloLink.execute(
      ApolloLink.from([createClientReleaseLink(), downstream]),
      { query, variables: {} },
      { client },
    ).subscribe({
      next: result => {
        received = result;
      },
      error: reject,
      complete: () => resolve(received),
    });
  });

describe('clientReleaseLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The server only attaches clientRelease to a client it can show is behind,
  // so presence is the entire signal — the link compares nothing.
  it('announces the recommended version when the extension is present', async () => {
    await run({ clientRelease: { recommended: '4.3.0' } });

    expect(announce).toHaveBeenCalledWith('4.3.0');
  });

  it('passes the result through untouched', async () => {
    const result = await run({ clientRelease: { recommended: '4.3.0' } });

    expect(result).toEqual({
      data: { me: { id: '1' } },
      extensions: { clientRelease: { recommended: '4.3.0' } },
    });
  });

  it('carries minimum alongside without changing behaviour', async () => {
    await run({ clientRelease: { recommended: '4.3.0', minimum: '4.0.0' } });

    expect(announce).toHaveBeenCalledWith('4.3.0');
  });

  it('stays silent on an ordinary response', async () => {
    await run(undefined);
    await run({});
    await run({ queued: true });

    expect(announce).not.toHaveBeenCalled();
  });

  // Extensions are server-authored; a malformed payload must not reach the
  // notice as `undefined` and get persisted as an announced version.
  it.each([
    ['a non-object clientRelease', { clientRelease: '4.3.0' }],
    ['a missing recommended', { clientRelease: { minimum: '4.0.0' } }],
    ['a non-string recommended', { clientRelease: { recommended: 430 } }],
    ['an empty recommended', { clientRelease: { recommended: '' } }],
    ['a null clientRelease', { clientRelease: null }],
  ])('ignores %s', async (_label, extensions) => {
    await run(extensions as Record<string, unknown>);

    expect(announce).not.toHaveBeenCalled();
  });
});
