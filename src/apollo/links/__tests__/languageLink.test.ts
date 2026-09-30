import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { Observable } from 'rxjs';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { changeLanguage } from '#/i18n';
import { languageLink } from '../languageLink';

const query = gql`
  query TestOp {
    me {
      id
    }
  }
`;

// ApolloLink.execute needs a client on its context; the downstream link below
// terminates the chain, so this one never reaches the network.
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.empty(),
  defaultOptions: APOLLO_DEFAULT_OPTIONS,
});

/** The headers the next link sees for one operation. */
const headersSent = (context: Record<string, unknown> = {}) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    let seen: Record<string, unknown> = {};
    const downstream = new ApolloLink(operation => {
      seen = operation.getContext().headers as Record<string, unknown>;
      return new Observable(observer => {
        observer.next({ data: { me: { id: '1' } } });
        observer.complete();
      });
    });
    ApolloLink.execute(
      ApolloLink.from([languageLink, downstream]),
      { query, variables: {}, context },
      { client },
    ).subscribe({ error: reject, complete: () => resolve(seen) });
  });

afterEach(async () => {
  await changeLanguage('en');
});

describe('languageLink', () => {
  it('sends the app language, and follows a switch', async () => {
    await changeLanguage('en');
    await expect(headersSent()).resolves.toMatchObject({
      'accept-language': 'en',
    });

    await changeLanguage('sq');
    await expect(headersSent()).resolves.toMatchObject({
      'accept-language': 'sq',
    });
  });

  it('keeps the headers set before it', async () => {
    await expect(
      headersSent({ headers: { 'x-api-key': 'key' } }),
    ).resolves.toEqual({ 'x-api-key': 'key', 'accept-language': 'en' });
  });
});
