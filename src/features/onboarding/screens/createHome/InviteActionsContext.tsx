import React, { createContext, useContext, type ReactNode } from 'react';
import { createActionsContext } from '#hooks/utils/createActionsContext';

interface InviteActions {
  handleAcceptInvite: (token: string) => void;
  handleDeclineInvite: (token: string, homeName: string) => void;
}

interface InviteActionsContextValue extends InviteActions {
  accepting: boolean;
}

const actionsContext = createActionsContext<InviteActions>(
  'InviteActionsProvider',
);

// `accepting` is reactive — cards must re-render when it flips — so it cannot
// live in the stable actions value, whose whole purpose is never to change.
const AcceptingContext = createContext<boolean | null>(null);

export const InviteActionsProvider: React.FC<{
  children: ReactNode;
  handleAcceptInvite: (token: string) => void;
  handleDeclineInvite: (token: string, homeName: string) => void;
  accepting: boolean;
}> = ({ children, handleAcceptInvite, handleDeclineInvite, accepting }) => (
  <actionsContext.Provider
    actions={{ handleAcceptInvite, handleDeclineInvite }}
  >
    <AcceptingContext.Provider value={accepting}>
      {children}
    </AcceptingContext.Provider>
  </actionsContext.Provider>
);

export const useInviteActions = (): InviteActionsContextValue => {
  const actions = actionsContext.useActions();
  const accepting = useContext(AcceptingContext);
  if (accepting === null) {
    throw new Error('InviteActionsProvider is missing its provider');
  }
  return { ...actions, accepting };
};
