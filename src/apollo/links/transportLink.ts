import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';
import { createHttpLink } from './httpLink';
import { persistedQueryLink, sortDefinitionsLink } from './persistedQueryLink';
import { wsLink } from './wsLink';

const isSubscription: Parameters<typeof ApolloLink.split>[0] = ({ query }) => {
  const def = getMainDefinition(query);
  return (
    def.kind === Kind.OPERATION_DEFINITION &&
    def.operation === OperationTypeNode.SUBSCRIPTION
  );
};

/**
 * Subscriptions ride graphql-ws, everything else HTTP with APQ. The operation
 * safelist hashes the text the server receives on BOTH, so each branch sends
 * its definitions in the manifest's sorted order; APQ itself is HTTP-only.
 */
export function createTransportLink(): ApolloLink {
  return ApolloLink.split(
    isSubscription,
    ApolloLink.from([sortDefinitionsLink, wsLink]),
    ApolloLink.from([persistedQueryLink, createHttpLink()]),
  );
}
