import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthFlow } from '#hooks/auth/useAuthFlow';
import { RememberMeModal } from '#screens/auth/RememberMeModal';
import { LoginInput, RegisterInput } from '#generated';

interface AuthFlowContextType {
  loginFlow: (input: LoginInput) => Promise<void>;
  registerFlow: (input: RegisterInput) => Promise<void>;
}

const AuthFlowContext = createContext<AuthFlowContextType | null>(null);

interface AuthFlowProviderProps {
  children: ReactNode;
}

export const AuthFlowProvider: React.FC<AuthFlowProviderProps> = ({
  children,
}) => {
  const {
    showRememberModal,
    pendingEmail,
    loginFlow,
    registerFlow,
    handleRememberChoice,
  } = useAuthFlow();

  const contextValue: AuthFlowContextType = {
    loginFlow,
    registerFlow,
  };

  return (
    <AuthFlowContext.Provider value={contextValue}>
      {children}

      {/* Centralized Remember Me Modal */}
      <RememberMeModal
        visible={showRememberModal}
        onAccept={() => handleRememberChoice(true)}
        onDecline={() => handleRememberChoice(false)}
        email={pendingEmail}
      />
    </AuthFlowContext.Provider>
  );
};

export const useAuthFlowContext = (): AuthFlowContextType => {
  const context = useContext(AuthFlowContext);
  if (!context) {
    throw new Error('useAuthFlowContext must be used within AuthFlowProvider');
  }
  return context;
};
