import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { useStore } from '#store';
import {
  mirroredFrom,
  settingsInput,
  type SettingValues,
} from '#/domain/serverSettings';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { snapshotFields } from '#/apollo/utils/localFirstFields';
import { useTranslation } from '#/i18n';

/**
 * The one writer of the account's settings: applied to the cache and the
 * store's mirror at once, replayed when the API is reachable, and put back
 * only when the server refuses. Its settle is the only alerter for a failure.
 */
export function useUpdateSettings() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate] = useMutation(UpdateUserPreferencesDocument, {
    context: { localFirst: true },
  });

  const updateSettings = async (
    updates: Partial<SettingValues>,
    failureMessage: string = t('settings.updateFailed'),
  ): Promise<boolean> => {
    const settings = client.cache.readQuery({
      query: GetUserSettingsDocument,
      optimistic: true,
    })?.me?.settings;
    // The store's mirror is no cached row, so its refusal is put back here.
    const previous = snapshotFields<SettingValues>(
      settings ?? mirroredFrom(useStore.getState()),
      updates,
    );
    useStore.getState().mirrorSettings(mirroredFrom(updates));

    const settled = await sendFields(client.cache, {
      entity: settings
        ? { __typename: 'UserSettings', id: settings.id }
        : undefined,
      fields: updates,
      variables: { input: settingsInput(updates) },
      mutate,
      settle: {
        document: UpdateUserPreferencesDocument,
        fallback: failureMessage,
      },
    });
    const landed = settled.status !== 'failed';
    if (!landed) useStore.getState().mirrorSettings(mirroredFrom(previous));
    return landed;
  };

  return { updateSettings };
}
