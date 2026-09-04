import { Linking } from 'react-native';

/**
 * A link carried by data the app did not author — a recipe's source, another
 * member's content — opens only as a web address. Any other scheme reaches a
 * different app: `tel:` places a call, `app-settings:` opens our own settings,
 * a custom scheme hands the payload to whatever registered it.
 */
const WEB_SCHEME = /^https?:\/\/\S/i;

export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && WEB_SCHEME.test(url.trim());
}

/**
 * Opens `url` when it is a web address. Resolves false when it is not, and when
 * the platform refuses it, so a caller reports one outcome for both.
 */
export async function openWebUrl(
  url: string | null | undefined,
): Promise<boolean> {
  if (!isWebUrl(url)) {
    return false;
  }
  let opened = false;
  try {
    await Linking.openURL(url.trim());
    opened = true;
  } catch {
    opened = false;
  }
  return opened;
}
