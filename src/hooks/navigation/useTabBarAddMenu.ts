import { useEffect, useState } from 'react';
import {
  useFocusEffect,
  useIsFocused,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import {
  useTabBarSetters,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { usePendingTabAdd } from '#store/useAppStore';
import type { PendingTabAdd } from '#store/slices/uiSlice';

interface Navigable {
  getState():
    | { type: string; index: number; routes: readonly { name: string }[] }
    | undefined;
  getParent(): NavigationProp<ParamListBase> | undefined;
}

/**
 * The tab holding the focused screen: the focused route of the nearest tab
 * navigator. Read at focus rather than from the tab bar's active tab, which a
 * lazily mounted tab's first focus can run ahead of.
 */
function focusedTab(navigation: Navigable): string | null {
  for (
    let nav: Navigable | undefined = navigation;
    nav;
    nav = nav.getParent()
  ) {
    const state = nav.getState();
    if (state?.type === 'tab') return state.routes[state.index]?.name ?? null;
  }
  return null;
}

/**
 * Runs an add another tab asked for: the named action, else the only one. One
 * still loading waits for the actions to change. One that cannot run says why:
 * in the menu when there are several, alone when there is one, since the bar
 * draws no menu for a single action.
 */
function startPendingAdd(
  pending: PendingTabAdd,
  actions: readonly TabBarAddAction[],
  openMenu: () => void,
): 'done' | 'waiting' {
  const action = pending.actionKey
    ? actions.find(candidate => candidate.key === pending.actionKey)
    : actions.length === 1
    ? actions[0]
    : undefined;
  if (action && !action.disabledReason) {
    action.onPress();
    return 'done';
  }
  if (action?.pending) return 'waiting';
  if (actions.length > 1) openMenu();
  else if (action?.disabledReason) toastService.info(action.disabledReason);
  return 'done';
}

/**
 * Gives the focused tab's `+` a menu of add actions. Registered per tab and
 * removed on unmount, so it survives the tab's blur; blur only closes it.
 */
export const useTabBarAddMenu = (actions: readonly TabBarAddAction[]) => {
  const { setAddMenu, setAddMenuOpen } = useTabBarSetters();
  const { navigation } = useAppNavigation();
  const isFocused = useIsFocused();
  const handedOver = usePendingTabAdd();
  const [tab, setTab] = useState<string | null>(null);

  useFocusEffect(() => {
    const focused = focusedTab(navigation);
    setTab(focused);
    // An add asked of another tab was for a tab the user did not reach.
    const { pendingTabAdd, clearPendingTabAdd } = useStore.getState();
    if (pendingTabAdd && pendingTabAdd.tab !== focused) clearPendingTabAdd();
    return () => {
      // Leaving the tab drops its own add, still waiting or not.
      const left = useStore.getState();
      if (left.pendingTabAdd?.tab === focused) left.clearPendingTabAdd();
      setAddMenuOpen(false);
    };
  });

  useEffect(() => {
    if (tab) setAddMenu(tab, actions);
  }, [tab, actions, setAddMenu]);

  useEffect(() => {
    if (!tab) return;
    return () => setAddMenu(tab, undefined);
  }, [tab, setAddMenu]);

  // After the commit that mounted the screen, so its sheets can open, and again
  // whenever the actions change, so one that was loading runs once it can. The
  // store is read here, not `handedOver`: a re-run must not start it twice.
  useEffect(() => {
    const pending = useStore.getState().pendingTabAdd;
    if (!isFocused || !tab || pending?.tab !== tab) return;
    const outcome = startPendingAdd(pending, actions, () =>
      setAddMenuOpen(true),
    );
    if (outcome === 'done') useStore.getState().clearPendingTabAdd();
  }, [isFocused, tab, handedOver, actions, setAddMenuOpen]);
};
