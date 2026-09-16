import { RetryLink } from '@apollo/client/link/retry';
import type { ApolloLink } from '@apollo/client/link';
import { isNetworkError } from '#/utils/isNetworkError';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';

const isMutation = (op: Pick<ApolloLink.Operation, 'query'>) => {
  const def = getMainDefinition(op.query);
  return (
    def.kind === Kind.OPERATION_DEFINITION &&
    def.operation === OperationTypeNode.MUTATION
  );
};

export const retryLink = new RetryLink({
  delay: { initial: 300, max: 5000, jitter: true },
  attempts: {
    max: 3,
    retryIf: (error, operation) => {
      if (operation.getContext().skipRetryLink) return false;
      if (isMutation(operation)) return false;
      return isNetworkError(error);
    },
  },
});
