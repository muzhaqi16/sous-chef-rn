import React, { useRef, type RefObject } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { ActionTray } from '#components/templates/ActionTray/ActionTray';
import type { ActionTrayRef } from '#components/templates/ActionTray/types';
import { ActionMenuRow } from '#components/molecules/ActionMenuRow';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import type { BarAction } from '#components/molecules/BarActions';
import { kitTestIDs } from '#components/testIDs';

/** The most trailing slots a bar gives its actions, "more" included. */
const MAX_SLOTS = 3;

/**
 * What a menu row can run: never a text action (no icon for the row) nor a
 * measured one (a spotlight's anchor stays in the bar).
 */
const menuActionOf = (action: BarAction): HeaderAction | null =>
  'label' in action || action.onMeasure ? null : action;

/**
 * Past `MAX_SLOTS`, a bar keeps its leading actions and puts the rest behind
 * "more", so a crowded bar never squeezes its title. Text actions and measured
 * ones (a spotlight's anchor) always stay; callers lead with the most used.
 */
export function splitBarActions<A extends BarAction>(
  actions: readonly A[],
): { shown: A[]; overflow: HeaderAction[] } {
  if (actions.length <= MAX_SLOTS) return { shown: [...actions], overflow: [] };

  let room =
    MAX_SLOTS - 1 - actions.filter(action => !menuActionOf(action)).length;
  const shown: A[] = [];
  const overflow: HeaderAction[] = [];
  for (const action of actions) {
    const menuAction = menuActionOf(action);
    if (menuAction && room <= 0) {
      overflow.push(menuAction);
    } else {
      shown.push(action);
      if (menuAction) room -= 1;
    }
  }
  return { shown, overflow };
}

/**
 * What a bar renders — its actions, with "more" last when some did not fit —
 * and the ref and contents of the `HeaderActionMenu` beside it.
 */
export function useHeaderOverflow<A extends BarAction>(actions: readonly A[]) {
  const { t } = useTranslation();
  const menuRef = useRef<ActionTrayRef>(null);
  const { shown, overflow } = splitBarActions(actions);
  const more: HeaderAction = {
    icon: 'ellipsis-vertical',
    onPress: () => menuRef.current?.open(),
    accessibilityLabel: t('labels.moreOptions'),
    testID: kitTestIDs.headerMoreButton,
  };
  return {
    barActions: overflow.length > 0 ? [...shown, more] : shown,
    menuRef,
    overflow,
  };
}

interface HeaderActionMenuProps {
  menuRef: RefObject<ActionTrayRef | null>;
  actions: readonly HeaderAction[];
}

/** A bar's overflow: each action as a row, run once the tray has closed. */
export const HeaderActionMenu: React.FC<HeaderActionMenuProps> = ({
  menuRef,
  actions,
}) => {
  // Run after the close, so an action that opens its own sheet does not stack
  // it on a tray still animating out.
  const pending = useRef<HeaderAction | null>(null);
  const handleClose = () => {
    const action = pending.current;
    pending.current = null;
    action?.onPress();
  };

  if (actions.length === 0) return null;

  return (
    <ActionTray ref={menuRef} onClose={handleClose}>
      <View style={styles.menu}>
        {actions.map((action, index) => (
          <ActionMenuRow
            key={action.testID ?? `${action.icon}-${index}`}
            icon={action.icon}
            library={action.library}
            label={action.accessibilityLabel}
            destructive={action.variant === 'error'}
            disabled={!!action.disabled || !!action.loading}
            testID={action.testID}
            onPress={() => {
              pending.current = action;
              menuRef.current?.close();
            }}
          />
        ))}
      </View>
    </ActionTray>
  );
};

const styles = StyleSheet.create(theme => ({
  menu: {
    gap: theme.spacing.sm,
  },
}));
