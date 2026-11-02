import { ApolloLink, type OperationVariables } from '@apollo/client';
import { isQueryOperation } from '@apollo/client/utilities';
import { tap } from 'rxjs';
import { isRecord } from '#/utils/isRecord';

export type AnswerNote = (
  data: Readonly<Record<string, unknown>>,
  variables: OperationVariables,
) => void;

/**
 * What a read records because the server answered it. Under `offlineReadLink`
 * and the local-write precedence link, so a read answered from the device
 * records nothing, as a field policy's `merge` cannot tell.
 */
export const createAnswerNotesLink = (notes: readonly AnswerNote[]) =>
  new ApolloLink((operation, forward) => {
    if (!isQueryOperation(operation.query)) return forward(operation);
    return forward(operation).pipe(
      tap(result => {
        if (!('data' in result) || !isRecord(result.data)) return;
        const { data } = result;
        notes.forEach(note => {
          note(data, operation.variables);
        });
      }),
    );
  });
