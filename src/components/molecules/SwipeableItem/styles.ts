import { StyleSheet } from 'react-native-unistyles';

// Inline the common style properties; spreading from another Unistyles stylesheet
// raises "2 unistyles styles" warnings.

// BORDER RADIUS: the card child (BaseItemCard, ListItem) is the single source of
// visible borderRadius + borderWidth. A backgroundColor on swipeableContainer or
// a borderRadius on childrenContainer produces a "double border".

// Action containers overhang HORIZONTALLY only — nothing covers a vertical
// overhang, so it paints a dark line above and below the row on any swipe.
export const styles = StyleSheet.create(theme => {
  // MUST match the card's own radius (`BaseItemCard.container`, `radii.xl`): a
  // tighter one makes the dark action container's corners poke out around the
  // card's instead of tucking under.
  const SWIPEABLE_RADIUS = theme.radii.xl;

  return {
    swipeableContainer: {
      overflow: 'visible',
      borderRadius: SWIPEABLE_RADIUS,
      borderCurve: 'continuous',
      // No backgroundColor — it bleeds through as a thin dark ring behind the
      // card's rounded border.
    },

    // No borderRadius — the card handles its own rounding. `overflow` must stay
    // `visible` so the card's soft drop shadow isn't clipped to a hard rectangle.
    childrenContainer: {
      overflow: 'visible',
    },

    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.charade['950'],
      justifyContent: 'center',
      marginLeft: -theme.spacing.base, // Extend under card edge to cover rounded corners
      paddingLeft: theme.spacing.base, // Compensate for margin to maintain button positioning
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
      marginRight: -theme.spacing.base, // Extend under card edge to cover rounded corners
      paddingRight: theme.spacing.base, // Compensate for margin to maintain button positioning
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
      borderWidth: theme.borderWidth.thin,
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
