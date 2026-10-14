import { skipToken, useQuery } from '@apollo/client/react';
import { appConfig } from '#/config/appConfig';
import { env } from '#/config/env';
import { resolveFeatureFlags, type FeatureFlag } from '#/config/featureFlags';
import { isServerOwned, serverFlagsOf } from '#/config/serverFeatureFlags';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { useUser } from '#store/useAppStore';

// A build's flags cannot change while it runs, so they resolve once.
const BUILD_FLAGS = resolveFeatureFlags(
  appConfig.featureFlags,
  env.FEATURE_FLAGS,
);

/**
 * Whether a capability is on: the build allows it and, for a flag the server
 * owns, the server says so for this user. Until the server's first answer on
 * this device a server-owned flag is off; after it, the cached answer holds.
 */
export const useFeatureFlag = (flag: FeatureFlag): boolean => {
  const user = useUser();
  const { data } = useQuery(
    MyFeatureFlagsDocument,
    user ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  if (!BUILD_FLAGS[flag]) return false;
  if (!isServerOwned(flag)) return true;
  if (!data) return false;
  return serverFlagsOf(data.myFeatureFlags)[flag] ?? false;
};
