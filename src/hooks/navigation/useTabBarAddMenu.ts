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
    tabRef.current = focusedTab(navigation);
    register();
    return () => settersRef.current.setAddMenuOpen(false);
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
