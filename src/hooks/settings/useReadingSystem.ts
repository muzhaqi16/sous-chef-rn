import { useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { resolveReadingSystem, type ReadingSystem } from '#domain/measure';

/**
 * The unit system amounts are shown in, from the cached settings: a change of
 * setting is written to the cache at once, so it applies offline too. For
 * signed-in screens; read once per screen or list and passed to rows.
 */
export function useReadingSystem(): ReadingSystem {
  const { data } = useQuery(GetUserSettingsDocument, {
    fetchPolicy: 'cache-first',
  });
  const settings = data?.me?.settings;
  return resolveReadingSystem(
    settings?.preferredUnitSystem,
    settings?.deviceUnitSystem,
  );
}
