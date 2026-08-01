import { StyleSheet } from 'react-native-unistyles';

// UNISTYLES FIX: Inline common style properties instead of spreading from commonStyles
// Spreading from another Unistyles stylesheet can cause "2 unistyles styles" warnings

// BORDER RADIUS CONVENTION:
// The card child (BaseItemCard, ListItem, etc.) is the single source of truth for visible
// borderRadius + borderWidth. SwipeableItem layers must NOT add their own visible radius:
// - swipeableContainer: keeps borderRadius for shadow shape only (NO backgroundColor)
// - childrenContainer: overflow:hidden without borderRadius — rectangular clip, child handles rounding
// - Action containers: use matching radius on their exposed (outer) edges only
// Adding backgroundColor to swipeableContainer or borderRadius to childrenContainer causes
// a "double border" artifact where the parent's radius clips/bleeds against the card's.
export const styles = StyleSheet.create(theme => {
  // Shared border radius for swipeable + action containers
  const SWIPEABLE_RADIUS = theme.radii.lg;

  return {
    gestureContainer: {
      overflow: 'visible', // Allow shadow to show and actions to extend
    },

    // Container style for Swipeable component (shadow shape only, no visible background)
    swipeableContainer: {
      overflow: 'visible',
      borderRadius: SWIPEABLE_RADIUS,
      borderCurve: 'continuous',
      // No backgroundColor here — it bleeds through as a thin dark ring behind
      // the card's rounded border. The action containers have their own dark bg.
    },

    // Children container style for Swipeable component.
    // No borderRadius here — the card inside handles its own rounding.
    // overflow must stay `visible` (like gestureContainer/swipeableContainer) so
    // the card child's soft drop shadow fades to transparent instead of being
    // clipped to a hard rectangular edge at the card bounds. The card sets its
    // own borderRadius, so nothing here needs clipping.
    childrenContainer: {
      overflow: 'visible',
    },

    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.charade['950'],
      justifyContent: 'center',
      marginLeft: -theme.spacing['3'], // Extend under card edge to cover rounded corners
      paddingLeft: theme.spacing['3'], // Compensate for margin to maintain button positioning
      marginVertical: -theme.spacing.xs, // Extend beyond swipeable bounds to cover card border/corners
      paddingVertical: theme.spacing.xs, // Compensate to keep buttons centered
      borderTopLeftRadius: 0, // Square edge where it meets the card
      borderBottomLeftRadius: 0,
      borderTopRightRadius: SWIPEABLE_RADIUS, // Rounded outer edge
      borderBottomRightRadius: SWIPEABLE_RADIUS,
    },
    leftActionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.charade['950'],
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginRight: -theme.spacing['3'], // Extend under card edge to cover rounded corners
      paddingRight: theme.spacing['3'], // Compensate for margin to maintain button positioning
      marginVertical: -theme.spacing.xs, // Extend beyond swipeable bounds to cover card border/corners
      paddingVertical: theme.spacing.xs, // Compensate to keep buttons centered
      borderTopRightRadius: 0, // Square edge where it meets the card
      borderBottomRightRadius: 0,
      borderTopLeftRadius: SWIPEABLE_RADIUS, // Rounded outer edge
      borderBottomLeftRadius: SWIPEABLE_RADIUS,
    },

    actionButton: {
      width: 50,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      zIndex: 100, // Ensure button is above other elements for touch priority
    },

    circularActionButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: theme.spacing.xs,
      zIndex: 100, // Ensure button is above other elements for touch priority
      borderWidth: 1.5,
      borderColor: theme.colors.white, // Subtle white border
      backgroundColor: 'transparent', // No fill - outlined style
    },

    editButton: {
      backgroundColor: theme.colors.success,
    },

    deleteButton: {
      backgroundColor: theme.colors.error,
    },

    deleteText: {
      color: theme.colors.white,
      fontSize: theme.fonts.size.xs,
      marginTop: theme.spacing.xs,
      fontWeight: theme.fonts.weight.semibold,
    },
  };
});
