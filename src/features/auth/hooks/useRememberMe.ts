import { useState } from 'react';
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
  const { markCredentialPromptDeclined } = useAuthPreferences();

  const handleRememberMeAccept = async () => {
    // The enrolment reports its own failure.
    if (pendingCredentials) await onAccept(pendingCredentials);
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
  };
};
