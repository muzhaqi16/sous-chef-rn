import { appConfig } from '#/config/appConfig';

/**
 * Shareable universal-link builders. The host comes from
 * `appConfig.identity.deepLink.hosts` (the one `RootNavigator` registers) and
 * the shapes match the API's `ShareLink.universal`. Prefer this https form to
 * `souschef://`, which dead-ends for a recipient without the app.
 */

const WEB_BASE_URL = `https://${appConfig.identity.deepLink.hosts[0]}`;

/** `https://app.souschef.dev/join-home/{joinCode}` — anyone-with-link home join. */
export const buildJoinHomeUrl = (joinCode: string): string =>
  `${WEB_BASE_URL}/join-home/${encodeURIComponent(joinCode)}`;

/** `https://app.souschef.dev/join-list/{shareCode}` — anyone-with-link list join. */
export const buildJoinListUrl = (shareCode: string): string =>
  `${WEB_BASE_URL}/join-list/${encodeURIComponent(shareCode)}`;
