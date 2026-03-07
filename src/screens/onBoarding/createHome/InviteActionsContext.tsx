import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

interface InviteActionsContextValue {
  handleAcceptInvite: (token: string) => void;
  handleDeclineInvite: (token: string, homeName: string) => void;
  accepting: boolean;
}

const InviteActionsContext = createContext<InviteActionsContextValue | null>(null);

export const InviteActionsProvider: React.FC<{
  children: ReactNode;
  handleAcceptInvite: (token: string) => void;
  handleDeclineInvite: (token: string, homeName: string) => void;
  accepting: boolean;
}> = ({ children, handleAcceptInvite, handleDeclineInvite, accepting }) => {
  const acceptRef = useRef(handleAcceptInvite);
  useEffect(() => { acceptRef.current = handleAcceptInvite; });

  const declineRef = useRef(handleDeclineInvite);
  useEffect(() => { declineRef.current = handleDeclineInvite; });

  const value: InviteActionsContextValue = {
    handleAcceptInvite: (token) => acceptRef.current(token),
    handleDeclineInvite: (token, homeName) => declineRef.current(token, homeName),
    accepting,
  };

  return (
    <InviteActionsContext.Provider value={value}>
      {children}
    </InviteActionsContext.Provider>
  );
};

export const useInviteActions = (): InviteActionsContextValue => {
  const ctx = useContext(InviteActionsContext);
  if (!ctx) throw new Error('useInviteActions must be used within InviteActionsProvider');
  return ctx;
};
