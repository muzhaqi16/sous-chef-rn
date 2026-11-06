import { Linking, Platform } from 'react-native';

// Mail's inbox. iOS answers canOpenURL for it only because Info.plist lists the
// `message` scheme under LSApplicationQueriesSchemes.
const IOS_MAIL_INBOX = 'message:';

/**
 * Whether the device's mail app can be opened. Android answers false: opening
 * its inbox takes CATEGORY_APP_EMAIL, which `Linking.sendIntent` cannot add.
 */
export async function canOpenMailApp(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await Linking.canOpenURL(IOS_MAIL_INBOX);
  } catch {
    return false;
  }
}

/** Opens the mail app's inbox; resolves false when it could not. */
export async function openMailApp(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  let opened = false;
  try {
    await Linking.openURL(IOS_MAIL_INBOX);
    opened = true;
  } catch {
    opened = false;
  }
  return opened;
}
