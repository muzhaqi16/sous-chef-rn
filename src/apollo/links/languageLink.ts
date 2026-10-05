import { ApolloLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { OperationTypeNode } from 'graphql';
import { tap } from 'rxjs';
import { getResolvedLanguage } from '#/i18n';
import { isRecord } from '#/utils/isRecord';
import { noteAnsweredInLanguage } from '../answeredSinceSwitch';

/**
 * Sends the app's language, read per request so a switch applies at once.
 * The API resolves catalog names (`Item.name`) by it; a server without that
 * support ignores the header.
 */
const sendLanguage = new SetContextLink(({ headers }) => ({
  headers: {
    ...(isRecord(headers) ? headers : {}),
    'accept-language': getResolvedLanguage(),
  },
}));

// Only a query is re-asked, and only its answer counts: complete, and in the
// language it was asked in, since one in flight across a switch still carries
// the old names.
const noteAnswers = new ApolloLink((operation, forward) => {
  if (operation.operationType !== OperationTypeNode.QUERY) {
    return forward(operation);
  }
  const askedIn = getResolvedLanguage();
  return forward(operation).pipe(
    tap(result => {
      const { operationName } = operation;
      if (
        operationName &&
        result.data &&
        !result.errors?.length &&
        askedIn === getResolvedLanguage()
      ) {
        noteAnsweredInLanguage(operationName, operation.variables);
      }
    }),
  );
});

export const languageLink = ApolloLink.from([sendLanguage, noteAnswers]);
