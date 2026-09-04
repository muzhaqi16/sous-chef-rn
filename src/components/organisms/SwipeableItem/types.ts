import type { ComponentRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Icon } from '#/utils/iconUtils';

export type SwipeableRef = React.RefObject<ComponentRef<
  typeof Swipeable
> | null>;

/**
 * One revealed action on a swipeable row. A DESCRIPTOR, never a named callback:
 * the caller declares its own verbs, so a new action never means editing this
 * molecule.
 */
export interface SwipeAction {
  /** Stable identity. Doubles as the accessibility action name. */
  key: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  /** i18n KEY for the accessibility label, resolved at render. */
  labelKey: string;
  onPress: () => void;
  testID?: string;
  /**
   * Light haptic before the press; default true. Per-action on purpose — an
   * action that opens its own confirming surface buzzes twice otherwise.
   */
  haptic?: boolean;
  /**
   * The action removes the row, so an animating card slides out before running it.
   * Read by the ROW renderer (`ItemCard`, `SortableItem`), never by `SwipeableItem`.
   */
  removesRow?: boolean;
}

export interface SwipeableItemProps {
  children: React.ReactNode;
  /** Drives the FlashList recycling reset — closes the swipeable on cell reuse. */
  itemId?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Revealed by swiping right (they sit on the row's left edge). */
  leftActions?: SwipeAction[];
  /** Revealed by swiping left (they sit on the row's right edge). */
  rightActions?: SwipeAction[];

  leftThreshold?: number;
  rightThreshold?: number;
  friction?: number;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  testIDPrefix?: string;
  enabled?: boolean;
  /** Horizontal travel (dp) before the row follows the finger. */
  dragOffset?: number;
}

export interface ActionButtonProps {
  onPress: () => void;
  icon: React.ComponentProps<typeof Icon>['name'];
  /** @deprecated The button is rendered as an outlined circle; backgroundColor is ignored. */
  backgroundColor?: string;
  label?: string;
  circular?: boolean;
  library?: string;
  testID?: string;
}

/**
 * Builds one row's swipe actions. A DERIVATION, not a command — a row calls it
 * while rendering — so it travels as a context VALUE, never through
 * `createActionsContext`, whose members are voided precisely so a derivation
 * cannot be stabilised behind a ref and go stale.
 */
export type ItemSwipeActionsFactory = (id: string) =>
  | {
      left?: SwipeAction[];
      right?: SwipeAction[];
    }
  | undefined;

export interface SwipeActionsProps {
  actions: SwipeAction[];
  /** Which edge these sit on; decides the container style only. */
  side: 'left' | 'right';
  swipeableRef?: SwipeableRef;
  progress?: SharedValue<number>;
}
