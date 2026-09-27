import { appConfig } from '#/config/appConfig';

/**
 * The root navigator's deep-link options. `initialRouteName` puts `Home` beneath
 * a root-level screen a cold-start link opens, or its back control has nothing
 * to pop; signed out, the router drops `Home` because its group is inactive.
 */
export const rootLinking = {
  prefixes: [
    `${appConfig.identity.deepLink.scheme}://`,
    ...appConfig.identity.deepLink.hosts.map(h => `https://${h}`),
  ],
  config: { initialRouteName: 'Home' },
};
