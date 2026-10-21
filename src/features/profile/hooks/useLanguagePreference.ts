import { useMutation } from '@apollo/client/react';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { usePreferences } from '#store/useAppStore';

/**
 * The app's language: switched on the device at once and saved to the account
 * (`updateSettings { regional }`). The write is `localFirst`, so an
 * unreachable API queues it; it has no optimistic response (the nested input
 * does not map onto the flat cached entity), so a queued write has nothing to
 * tear down and replays idempotently. A failure is alerted.
 */
export function useLanguagePreference() {
  const { t } = useTranslation();
  const { language, setLanguage } = usePreferences();
  const [updateSettings] = useMutation(UpdateUserPreferencesDocument, {
    context: { localFirst: true },
  });

  const selectLanguage = (next: string): void => {
    setLanguage(next);
    void settleMutation(
      () =>
        updateSettings({
          variables: { input: { regional: { language: next } } },
        }),
      {
        document: UpdateUserPreferencesDocument,
        fallback: t('errors.codes.genericRetry'),
      },
    );
  };

  return { language, selectLanguage };
}
