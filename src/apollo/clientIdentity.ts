import { getVersion } from 'react-native-device-info';

/**
 * Name the server matches against its MIN_CLIENT_VERSIONS table. One name is
 * used for both platforms — the server gates on the build, not the OS. It must
 * stay byte-identical across releases: a name the server has no entry for is
 * always admitted, which would silently exempt this build from the gate.
 */
export const CLIENT_NAME = 'sous-chef-app';

/**
 * Native build version (Android versionName / iOS MARKETING_VERSION), not the
 * package.json one — the server gates the INSTALLED app, and only a store
 * update moves this. Must parse as semver: an unparseable value reads as
 * absent, and the request is refused once a minimum is configured.
 */
export const CLIENT_VERSION = getVersion();
