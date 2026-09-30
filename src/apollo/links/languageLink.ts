import { SetContextLink } from '@apollo/client/link/context';
import { getResolvedLanguage } from '#/i18n';
import { isRecord } from '#/utils/isRecord';

/**
 * Sends the app's language, read per request so a switch applies at once.
 * The API resolves catalog names (`Item.name`) by it; a server without that
 * support ignores the header.
 */
export const languageLink = new SetContextLink(({ headers }) => ({
  headers: {
    ...(isRecord(headers) ? headers : {}),
    'accept-language': getResolvedLanguage(),
  },
}));
