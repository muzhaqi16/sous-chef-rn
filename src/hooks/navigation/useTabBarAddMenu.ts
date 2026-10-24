import { useEffect, useRef, useState } from 'react';
import {
  useFocusEffect,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import {
  useTabBarSetters,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useStore } from '#store';
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
 * Runs an add another tab asked for: the named action, else the only one, else
 * the menu. A disabled action opens the menu too, so its reason shows.
 */
function startPendingAdd(
  pending: PendingTabAdd,
  actions: readonly TabBarAddAction[],
  openMenu: () => void,
) {
  const action = pending.actionKey
    ? actions.find(candidate => candidate.key === pending.actionKey)
    : actions.length === 1
    ? actions[0]
    : undefined;
  if (action && !action.disabledReason) action.onPress();
  else openMenu();
}

/** What the menu shows; handlers are left out, since a press reads the latest. */
const shownAs = (action: TabBarAddAction) =>
  [action.key, action.label, action.icon, action.disabledReason ?? ''].join(
    '\u0000',
  );

/**
 * Gives the focused tab's `+` a menu of add actions. Registered per tab and
 * removed on unmount, so it survives the tab's blur; blur only closes it. A
 * changed handler re-registers nothing; a changed label or reason does.
 */
export const useTabBarAddMenu = (actions: readonly TabBarAddAction[]) => {
  const setters = useTabBarSetters();
  const { navigation } = useAppNavigation();
  const actionsRef = useRef(actions);
  const settersRef = useRef(setters);
  const tabRef = useRef<string | null>(null);

  useEffect(() => {
    actionsRef.current = actions;
    settersRef.current = setters;
  });

  const [register] = useState(() => () => {
    const tab = tabRef.current;
    if (!tab) return;
    settersRef.current.setAddMenu(
      tab,
      actionsRef.current.map(action => ({
        ...action,
        onPress: () =>
          actionsRef.current
            .find(latest => latest.key === action.key)
            ?.onPress(),
      })),
    );
  });

  const [onFocusEffect] = useState(() => () => {
    const tab = focusedTab(navigation);
    tabRef.current = tab;
    register();
    const pending = tab ? useStore.getState().takePendingTabAdd(tab) : null;
    // A frame later, so a tab mounting on this focus has its sheets mounted.
    const frame = pending
      ? requestAnimationFrame(() =>
          startPendingAdd(pending, actionsRef.current, () =>
            settersRef.current.setAddMenuOpen(true),
          ),
        )
      : null;
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      settersRef.current.setAddMenuOpen(false);
    };
  });
  useFocusEffect(onFocusEffect);

  const signature = actions.map(shownAs).join('\u0001');
  useEffect(() => {
    register();
  }, [signature, register]);

  useEffect(
    () => () => {
      const tab = tabRef.current;
      if (tab) settersRef.current.setAddMenu(tab, undefined);
    },
    [],
  );
};
