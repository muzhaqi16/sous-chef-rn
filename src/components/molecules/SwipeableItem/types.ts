import type { ComponentRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Icon } from '#/utils/iconUtils';

export type SwipeableRef = React.RefObject<ComponentRef<
  typeof Swipeable
> | null>;

/**
 * One revealed action on a swipeable row.
 *
 * A descriptor rather than a named callback: this component used to take seven
 * (`onConsume`, `onWaste`, `onRestock`, `onTogglePurchase`, …) plus a
 * `swipeMode: 'shopping' | 'pantry'`, with the icon for each verb hardcoded in
 * the action components. Adding an action to a new screen — or a new app — meant
 * editing this molecule. Now the caller says what its actions are.
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
   * Fire a light haptic before the press. Defaults to true.
   *
   * The pantry's consume/waste/restock actions pass `false` — they have never
   * buzzed, unlike edit/delete/toggle-purchase. Preserved as a per-action
   * choice rather than silently unified.
   */
  haptic?: boolean;
  /**
   * This action removes the row, so a card that animates removals should slide
   * out before running it.
   *
   * Read by the ROW renderer (`ItemCard`, `SortableItem`), not by
   * `SwipeableItem` — the swipe molecule has no opinion about what an action
   * does to the list around it.
   */
  removesRow?: boolean;
}

export interface SwipeableItemProps {
  children: React.ReactNode;
  /** Item ID for FlashList recycling reset — closes swipeable when cell is reused */
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
  /** Disables swipe gestures when false (e.g. during tutorial spotlight steps) */
  enabled?: boolean;
  /**
   * Horizontal travel (dp) before the row starts following the finger. Raise it
   * if scrolling still opens rows; lower it for a more eager swipe.
   */
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

export interface SwipeActionsProps {
  actions: SwipeAction[];
  /** Which edge these sit on — decides the container style only. */
  side: 'left' | 'right';
  swipeableRef?: SwipeableRef;
  progress?: SharedValue<number>;
}
