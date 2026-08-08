import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';
import { useToast } from '#/hooks/useToast';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { useAuthPreferences } from '#/hooks/navigation/useAuthPreferences';
import { t } from '#/i18n/t';

export interface RememberMeCredentials {
  email: string;
  password: string;
}

export interface RememberMeEvents {
  onAccept: (credentials: RememberMeCredentials) => Promise<void>;
  onDecline: () => void;
}

/**
 * Hook for managing RememberMe modal state and logic.
 * This hook only handles modal state and user interactions - it doesn't know
 * HOW credentials are stored, just WHAT the user wants to do with them.
 */
export const useRememberMe = ({ onAccept, onDecline }: RememberMeEvents) => {
  // RememberMe modal state
  const [showRememberMeModal, setShowRememberMeModal] = useState(false);
  const [pendingCredentials, setPendingCredentials] =
    useState<RememberMeCredentials | null>(null);

  // Dependencies
  const toast = useToast();
  const { markCredentialPromptDeclined } = useAuthPreferences();

  const handleRememberMeAccept = async () => {
    if (pendingCredentials) {
      await executeMutation(
        async () => {
          await onAccept(pendingCredentials);
          logger.debug('Credentials accepted by user');
        },
        error => {
          errorService.reportError(error, {
            operation: 'processCredentialAcceptance',
          });
          toast({
            message: t('errors.saveLoginFailed'),
            type: 'error',
          });
        },
      );
    }
    setShowRememberMeModal(false);
    setPendingCredentials(null);
  };

  const handleRememberMeDecline = () => {
    setShowRememberMeModal(false);

    // Track credential prompt declination to avoid showing it again
    markCredentialPromptDeclined();

    setPendingCredentials(null);
    onDecline();
  };

  // Helper function to show the RememberMe modal
  const showRememberMePrompt = (credentials: RememberMeCredentials) => {
    setPendingCredentials(credentials);
    setShowRememberMeModal(true);
  };

  return {
    // State
    showRememberMeModal,
    pendingCredentials,

    // Actions
    handleRememberMeAccept,
    handleRememberMeDecline,
    showRememberMePrompt,

    // Internal state management
    setShowRememberMeModal,
    setPendingCredentials,
  };
};
