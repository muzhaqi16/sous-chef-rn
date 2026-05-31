import { RetryLink } from '@apollo/client/link/retry';
import type { ApolloLink } from '@apollo/client/link';
import { isNetworkError } from '#/utils/isNetworkError';
import { getMainDefinition } from '@apollo/client/utilities';

const isMutation = (op: Pick<ApolloLink.Operation, 'query'>) => {
  const def = getMainDefinition(op.query);
  return def.kind === 'OperationDefinition' && def.operation === 'mutation';
};

export const retryLink = new RetryLink({
  delay: { initial: 300, max: 5000, jitter: true },
  attempts: {
    max: 3,
    retryIf: (error, operation) => {
      if (!error) return false;
      if (operation.getContext().skipRetryLink) return false;
      if (isMutation(operation)) return false;
      return isNetworkError(error);
    },
  },
});
