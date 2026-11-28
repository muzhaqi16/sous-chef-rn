import type { FeatureFlag } from '#config/featureFlags';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUser } from '#store/useAppStore';

/**
 * Whether an account was made before a day, such as the release that brought
 * a feature. An account with no recorded creation predates anything that
 * records it.
 */
function accountPredates(
  createdAt: string | undefined,
  introducedOn: string,
): boolean {
  if (!createdAt) return true;
  return Date.parse(createdAt) < Date.parse(introducedOn);
}

/**
 * Whether a feature's tour may show: to an account made before the release
 * that brought the feature, while the feature is on. An account made since
 * met the feature with the rest of the app.
 */
export function useNewFeatureTour({
  introducedOn,
  flag,
}: {
  /** The day the feature's release reached production. */
  introducedOn: string;
  flag: FeatureFlag;
}): boolean {
  const user = useUser();
  const on = useFeatureFlag(flag);
  return on && !!user && accountPredates(user.createdAt, introducedOn);
}
