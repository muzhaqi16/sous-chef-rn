import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { useStore } from '#store';
import { useUser } from '#store/useAppStore';
import { mirroredFrom } from '#/domain/serverSettings';

/**
 * Mirrors the account's settings into the store on every settings read, so a
 * change made on another device reaches this one. Mounted once per session.
 */
export function useSettingsMirror(): void {
  const user = useUser();
  const { data } = useQuery(GetUserSettingsDocument, user?.id ? {} : skipToken);
  const settings = data?.me?.settings;
  useEffect(() => {
    if (settings) useStore.getState().mirrorSettings(mirroredFrom(settings));
  }, [settings]);
}
