import { StyleSheet } from 'react-native-unistyles';

// UNISTYLES FIX: Inline common style properties instead of spreading from commonStyles
// Spreading from another Unistyles stylesheet can cause "2 unistyles styles" warnings

// IMPORTANT: All border radii in SwipeableItem must match to prevent visual gaps during
// swipe animations. The container, children container, and action containers all use
// the same radius (theme.radii.lg). Mismatched radii cause sub-pixel gaps between layers.
export const styles = StyleSheet.create(theme => {
  // Shared border radius for all swipeable containers - DO NOT use different values
  const SWIPEABLE_RADIUS = theme.radii.lg;

  return {
    gestureContainer: {
      overflow: 'visible', // Allow shadow to show and actions to extend
    },

    // Container style for Swipeable component
    // Background matches action containers so the area behind the sliding card
    // is dark during swipe — no transparent gap between card and actions.
    swipeableContainer: {
      overflow: 'visible' as const,
      backgroundColor: 'transparent',
      borderRadius: SWIPEABLE_RADIUS,
    },

    // Children container style for Swipeable component
    childrenContainer: {
      overflow: 'hidden' as const,
      borderRadius: SWIPEABLE_RADIUS,
    },

    actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    backgroundColor: theme.colors.charade['950'],
    justifyContent: 'center',
    width: 160,
    marginLeft: -12, // Extend under card edge to cover rounded corners
    paddingLeft: 12, // Compensate for margin to maintain button positioning
    borderTopLeftRadius: 0, // Square edge where it meets the card
    borderBottomLeftRadius: 0,
    borderTopRightRadius: SWIPEABLE_RADIUS, // Rounded outer edge
    borderBottomRightRadius: SWIPEABLE_RADIUS,
  },
  leftActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    backgroundColor: theme.colors.charade['950'],
    justifyContent: 'center',
    width: 180,
    gap: theme.spacing.xs,
    marginRight: -12, // Extend under card edge to cover rounded corners
    paddingRight: 12, // Compensate for margin to maintain button positioning
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
    marginHorizontal: 4,
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
    fontSize: 12,
    marginTop: theme.spacing.xs,
    fontWeight: theme.fonts.weight.semibold,
  },
};
});
