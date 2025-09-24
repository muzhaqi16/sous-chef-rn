import { useState, useCallback } from 'react';
import { useStore } from '#store';
import { useAuth } from './useAuth';
import { LoginInput, RegisterInput } from '#generated';

interface AuthFlowState {
  showRememberModal: boolean;
  pendingCredentials: {
    email: string;
    password: string;
    type: 'login' | 'register';
    registerData?: RegisterInput;
  } | null;
  pendingAuthData: any | null;
}

export const useAuthFlow = () => {
  const { rememberMe, hasStoredCredentials } = useStore();
  const {
    login,
    register,
    storeCredentials,
    handleLogin,
    handleRegistration,
    authenticateUser,
    registerUser
  } = useAuth();

  const [flowState, setFlowState] = useState<AuthFlowState>({
    showRememberModal: false,
    pendingCredentials: null,
    pendingAuthData: null,
  });

  const shouldShowRememberModal = useCallback((): boolean => {
    return rememberMe === undefined && !hasStoredCredentials;
  }, [rememberMe, hasStoredCredentials]);

  const loginFlow = useCallback(async (input: LoginInput): Promise<void> => {
    if (shouldShowRememberModal()) {
      // Get auth data but don't set auth state yet
      const authData = await authenticateUser(input);

      if (authData) {
        setFlowState({
          showRememberModal: true,
          pendingCredentials: {
            email: input.email,
            password: input.password,
            type: 'login',
          },
          pendingAuthData: authData,
        });
      }
    } else {
      // Direct login with existing preference
      await login(input, rememberMe ?? false);
    }
  }, [authenticateUser, login, rememberMe, shouldShowRememberModal]);

  const registerFlow = useCallback(async (input: RegisterInput): Promise<void> => {
    if (shouldShowRememberModal()) {
      // Get registration data but don't set auth state yet
      const authData = await registerUser(input);

      if (authData) {
        setFlowState({
          showRememberModal: true,
          pendingCredentials: {
            email: input.email,
            password: input.password,
            type: 'register',
            registerData: input,
          },
          pendingAuthData: authData,
        });
      }
    } else {
      // Direct registration with existing preference
      await register(input, rememberMe ?? false);
    }
  }, [registerUser, register, rememberMe, shouldShowRememberModal]);

  const handleRememberChoice = useCallback(async (remember: boolean): Promise<void> => {
    const { pendingCredentials, pendingAuthData } = flowState;

    if (!pendingCredentials) return;

    // Close modal first
    setFlowState({
      showRememberModal: false,
      pendingCredentials: null,
      pendingAuthData: null,
    });

    // Save credentials if user chose to remember
    if (remember) {
      await storeCredentials(pendingCredentials.email, pendingCredentials.password);
    }

    // Update remember me preference in store
    useStore.getState().setRememberMe(remember);

    // Complete authentication flow
    if (pendingAuthData) {
      if (pendingCredentials.type === 'login') {
        await handleLogin(pendingAuthData, remember);
      } else if (pendingCredentials.type === 'register') {
        await handleRegistration(pendingAuthData, remember);
      }
    }
  }, [flowState, storeCredentials, handleLogin, handleRegistration]);

  const closeModal = useCallback((): void => {
    const { pendingCredentials, pendingAuthData } = flowState;

    setFlowState(prev => ({
      ...prev,
      showRememberModal: false,
      pendingCredentials: null,
      pendingAuthData: null,
    }));

    // If user closes modal without choice, complete auth with default (false)
    if (pendingCredentials && pendingAuthData) {
      if (pendingCredentials.type === 'login') {
        handleLogin(pendingAuthData, false);
      } else if (pendingCredentials.type === 'register') {
        handleRegistration(pendingAuthData, false);
      }
    }
  }, [flowState, handleLogin, handleRegistration]);

  return {
    // State
    showRememberModal: flowState.showRememberModal,
    pendingEmail: flowState.pendingCredentials?.email || '',

    // Actions
    loginFlow,
    registerFlow,
    handleRememberChoice,
    closeModal,
  };
};