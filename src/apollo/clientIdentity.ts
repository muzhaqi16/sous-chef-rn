import { getVersion } from 'react-native-device-info';

/**
 * Name the server matches against its MIN_CLIENT_VERSIONS table. One name is
 * used for both platforms — the server gates on the build, not the OS. It must
 * stay byte-identical across releases: a name the server has no entry for is
 * always admitted, which would silently exempt this build from the gate.
 */
export const CLIENT_NAME = 'sous-chef-app';

/**
 * Native build version (Android versionName / iOS MARKETING_VERSION) rather
 * than the package.json version. The server decides whether the *installed*
 * app is below its minimum, and a store update is what moves this number;
 * package.json can advance in the repo without any user's install changing.
 * Must parse as semver — the server treats an unparseable value as absent and
 * refuses the request once a minimum is configured.
 */
export const CLIENT_VERSION = getVersion();
