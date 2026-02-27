import { useState } from 'react';
import { useToast } from '#/hooks/useToast';
import { executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';
import { useUserPreferences } from '#/hooks/navigation/useUserPreferences';

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
  const [pendingCredentials, setPendingCredentials] = useState<RememberMeCredentials | null>(null);

  // Dependencies
  const toast = useToast();
  const { markCredentialPromptDeclined } = useUserPreferences();

  const handleRememberMeAccept = async () => {
    if (pendingCredentials) {
      await executeMutationWithErrorHandler(
        async () => {
          await onAccept(pendingCredentials);
          console.log('Credentials accepted by user');
        },
        (error) => {
          console.error('Failed to process credential acceptance:', error);
          toast({
            message: 'Failed to save login information',
            type: 'error' });
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
    setPendingCredentials };
};