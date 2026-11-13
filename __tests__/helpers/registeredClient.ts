import { ApolloClient, ApolloLink } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { registerApolloClient } from '#/apollo/clientRegistry';
import {
  servedMocks,
  testMockLink,
  type RecordedMock,
} from './apolloMockProvider';

/**
 * A client over `answers`, registered as the app's, for code that reads the
 * client registry rather than a provider: the production cache and default
 * options, each answer completed from the SDL as a provider's would be.
 */
export function registerTestClient(
  answers: RecordedMock[],
  links: ApolloLink[] = [],
): ApolloClient {
  const client = new ApolloClient({
    cache: makeCache(),
    link: ApolloLink.from([
      ...links,
      testMockLink(servedMocks(answers.map(answer => answer.mock)), {
        showWarnings: false,
      }),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  registerApolloClient(client);
  return client;
}
