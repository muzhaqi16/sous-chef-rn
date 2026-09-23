import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useAuthPreferences } from '#/hooks/navigation/useAuthPreferences';

/** Who the prompt is about. Enrolment authorises off the live session, so the
 * password never travels with it. */
export interface RememberMeCredentials {
  email: string;
}

export interface RememberMeEvents {
  onAccept: (credentials: RememberMeCredentials) => Promise<void>;
  onDecline: () => void;
}

/**
 * The "remember login info?" prompt. It knows WHAT the person chose, not HOW
 * credentials are stored — the caller's `onAccept` does the enrolment.
 */
export const useRememberMe = ({ onAccept, onDecline }: RememberMeEvents) => {
  const { t } = useTranslation();
  const { markCredentialPromptDeclined } = useAuthPreferences();

  const showRememberMePrompt = (credentials: RememberMeCredentials) => {
    alertService.alert(
      t('rememberMe.title'),
      t('rememberMe.body', { email: credentials.email }),
      [
        {
          text: t('rememberMe.notNow'),
          style: 'cancel',
          onPress: () => {
            // Not asked again on this install.
            markCredentialPromptDeclined();
            onDecline();
          },
        },
        {
          text: t('rememberMe.remember'),
          onPress: () => {
            // The enrolment reports its own failure.
            void onAccept(credentials);
          },
        },
      ],
    );
  };

  return { showRememberMePrompt };
};
