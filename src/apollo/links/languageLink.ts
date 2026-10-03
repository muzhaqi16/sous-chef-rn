import { ApolloLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
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

// An answer counts only in the language it was asked in: one in flight across
// a switch still carries the old names.
const noteAnswers = new ApolloLink((operation, forward) => {
  const askedIn = getResolvedLanguage();
  return forward(operation).pipe(
    tap(result => {
      const { operationName } = operation;
      if (operationName && result.data && askedIn === getResolvedLanguage()) {
        noteAnsweredInLanguage(operationName, operation.variables);
      }
    }),
  );
});

export const languageLink = ApolloLink.from([sendLanguage, noteAnswers]);
