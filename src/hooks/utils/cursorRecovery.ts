import type { OperationVariables } from '@apollo/client';
import { errorService } from '#/services/errorService';
import { isDeadCursorError } from '#/utils/errors/graphqlErrors';

interface LoadPageArgs {
  fetchMore: (options: { variables: OperationVariables }) => Promise<unknown>;
  /** Re-reads the collection from its first page. */
  refetch: () => Promise<unknown>;
  variables: OperationVariables;
  /** Names this call site in the diagnostic channel. */
  operation: string;
}

/**
 * Fetch the next page, recovering if the server refuses the cursor. A refused
 * cursor cannot be retried — the stored value is the only one there is — so the
 * collection is re-read from page one and the reader is shown nothing.
 * Module scope, so no call site captures it in a dependency array.
 */
export async function loadPageWithCursorRecovery({
  fetchMore,
  refetch,
  variables,
  operation,
}: LoadPageArgs): Promise<void> {
  let deadCursor = false;
  try {
    await fetchMore({ variables });
    return;
  } catch (error) {
    deadCursor = isDeadCursorError(error, variables);
    errorService.reportError(error, { operation });
  }

  if (!deadCursor) return;

  try {
    await refetch();
  } catch (restartError) {
    errorService.reportError(restartError, {
      operation: `${operation}.restartAfterDeadCursor`,
    });
  }
}
