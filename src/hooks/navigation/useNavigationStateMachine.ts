import {useReducer, useCallback} from 'react';

export enum NavigationState {
  LOADING = 'LOADING',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  NEEDS_ONBOARDING = 'NEEDS_ONBOARDING',
  AUTHENTICATED = 'AUTHENTICATED',
}

type NavigationAction =
  | {type: 'APP_HYDRATED'}
  | {type: 'LOGIN_SUCCESS'}
  | {type: 'LOGOUT'}
  | {type: 'EMAIL_VERIFIED'}
  | {type: 'ONBOARDING_COMPLETED'};

export const NAVIGATION_TRANSITIONS: Record<
  NavigationState,
  NavigationState[]
> = {
  [NavigationState.LOADING]: Object.values(NavigationState),
  [NavigationState.UNAUTHENTICATED]: [
    NavigationState.NEEDS_VERIFICATION,
    NavigationState.NEEDS_ONBOARDING,
    NavigationState.AUTHENTICATED,
  ],
  [NavigationState.NEEDS_VERIFICATION]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.NEEDS_ONBOARDING,
    NavigationState.AUTHENTICATED,
  ],
  [NavigationState.NEEDS_ONBOARDING]: [
    NavigationState.UNAUTHENTICATED,
    NavigationState.AUTHENTICATED,
  ],
  [NavigationState.AUTHENTICATED]: [NavigationState.UNAUTHENTICATED],
};

function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  let newState: NavigationState;

  switch (action.type) {
    case 'APP_HYDRATED':
      newState = NavigationState.UNAUTHENTICATED;
      break;
    case 'LOGIN_SUCCESS':
      newState = NavigationState.NEEDS_VERIFICATION;
      break;
    case 'EMAIL_VERIFIED':
      newState = NavigationState.NEEDS_ONBOARDING;
      break;
    case 'ONBOARDING_COMPLETED':
      newState = NavigationState.AUTHENTICATED;
      break;
    case 'LOGOUT':
      newState = NavigationState.UNAUTHENTICATED;
      break;
    default:
      return state;
  }

  // Validate transition
  const validTransitions = NAVIGATION_TRANSITIONS[state];
  if (!validTransitions.includes(newState)) {
    console.warn(`Invalid transition from ${state} to ${newState}`);
    return state;
  }

  return newState;
}

export const useNavigationStateMachine = (
  initialState = NavigationState.LOADING,
) => {
  const [state, dispatch] = useReducer(navigationReducer, initialState);

  const canTransitionTo = useCallback(
    (targetState: NavigationState) => {
      return NAVIGATION_TRANSITIONS[state].includes(targetState);
    },
    [state],
  );

  return {
    state,
    dispatch,
    canTransitionTo,
  };
};
