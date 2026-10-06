import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import type { DocumentNode, FormattedExecutionResult } from 'graphql';
import { Observable } from 'rxjs';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { changeLanguage } from '#/i18n';
import {
  startAnswersForSwitch,
  wasAnsweredSinceSwitch,
} from '#/apollo/answeredSinceSwitch';
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

/** Runs one operation through the link, answered with `result`. */
const answer = (document: DocumentNode, result: FormattedExecutionResult) =>
  new Promise<void>((resolve, reject) => {
    const downstream = new ApolloLink(
      () =>
        new Observable(observer => {
          observer.next(result);
          observer.complete();
        }),
    );
    ApolloLink.execute(
      ApolloLink.from([languageLink, downstream]),
      { query: document, variables: {} },
      { client },
    ).subscribe({ error: reject, complete: resolve });
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

  describe('what it records as answered since a switch', () => {
    beforeEach(() => {
      startAnswersForSwitch();
    });

    it('records a query answered without errors', async () => {
      await answer(query, { data: { me: { id: '1' } } });

      expect(wasAnsweredSinceSwitch('TestOp', {})).toBe(true);
    });

    it('leaves out an answer that carried errors', async () => {
      await answer(query, {
        data: { me: null },
        errors: [{ message: 'Internal server error' }],
      });

      expect(wasAnsweredSinceSwitch('TestOp', {})).toBe(false);
    });

    // A write is never re-asked, and a receipt parse's variables are large.
    it('leaves out a mutation', async () => {
      const mutation = gql`
        mutation TestWrite {
          touch
        }
      `;
      await answer(mutation, { data: { touch: true } });

      expect(wasAnsweredSinceSwitch('TestWrite', {})).toBe(false);
    });
  });

  it('keeps the headers set before it', async () => {
    await expect(
      headersSent({ headers: { 'x-api-key': 'key' } }),
    ).resolves.toEqual({ 'x-api-key': 'key', 'accept-language': 'en' });
  });
});
