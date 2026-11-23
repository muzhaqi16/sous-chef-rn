import type { ApolloCache } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
  type UpdateUserPreferencesMutationVariables,
} from '#operations/auth/user.generated';
import { useStore } from '#store';
import {
  mirroredFrom,
  refusedMirror,
  settingsInput,
  type SettingValues,
} from '#/domain/serverSettings';
import {
  sendLocalWrite,
  type WriteSettle,
} from '#/apollo/pendingWrites/useLocalWrite';
import type { LocalWriteSend } from '#/apollo/pendingWrites/pendingWrites';
import { snapshotFields } from '#/apollo/utils/localFirstFields';
import { useTranslation } from '#/i18n';

/**
 * The one writer of the account's settings: applied to the cache and the
 * store's mirror at once, replayed when the API is reachable, and put back
 * only when the server refuses it, where no later change has replaced it.
 * Module scope so the timezone effect's dependency never re-arms it. True when
 * the change counts as saved (queued included).
 */
export async function applyAccountSettings({
  cache,
  updates,
  mutate,
  settle,
}: {
  cache: ApolloCache;
  updates: Partial<SettingValues>;
  mutate: (
    write: LocalWriteSend<UpdateUserPreferencesMutationVariables>,
  ) => Promise<{ data?: unknown; error?: unknown }>;
  settle: WriteSettle;
}): Promise<boolean> {
  const settings = cache.readQuery({
    query: GetUserSettingsDocument,
    optimistic: true,
  })?.me?.settings;
  // The store's mirror is no cached row, so its refusal is put back here.
  const previous = snapshotFields<SettingValues>(
    settings ?? mirroredFrom(useStore.getState()),
    updates,
  );
  useStore.getState().mirrorSettings(mirroredFrom(updates));

  const settled = await sendLocalWrite(
    cache,
    UpdateUserPreferencesDocument,
    { input: settingsInput(updates) },
    mutate,
    settle,
    {
      entity: settings
        ? { __typename: 'UserSettings', id: settings.id }
        : undefined,
      fields: updates,
    },
  );
  const landed = settled.status !== 'failed';
  if (!landed) {
    useStore
      .getState()
      .mirrorSettings(
        refusedMirror(
          mirroredFrom(previous),
          mirroredFrom(updates),
          mirroredFrom(useStore.getState()),
        ),
      );
  }
  return landed;
}

/** The account-settings writer, for a component; its settle is the only alerter. */
export function useUpdateSettings() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [updatePreferences] = useMutation(UpdateUserPreferencesDocument, {
    context: { localFirst: true },
  });

  const updateSettings = (
    updates: Partial<SettingValues>,
    failureMessage: string = t('settings.updateFailed'),
  ): Promise<boolean> =>
    applyAccountSettings({
      cache: client.cache,
      updates,
      mutate: updatePreferences,
      settle: { fallback: failureMessage },
    });

  return { updateSettings };
}
