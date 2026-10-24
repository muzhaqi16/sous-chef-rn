import { StyleSheet } from 'react-native-unistyles';

// Inline the common style properties; spreading from another Unistyles stylesheet
// raises "2 unistyles styles" warnings.

// CORNERS: the row's `RowCard` rounds the tray's outer corners. The sliding
// content rounds its own, so its leading edge meets the tray as a rounded end.
// Its clip cannot cut a shadow: the shadow is the card's, outside it.

// Action containers overhang HORIZONTALLY only, tucked under the opaque row —
// nothing covers a vertical overhang, so it paints a dark line above and below
// the row on any swipe.
export const styles = StyleSheet.create(theme => {
  return {
    swipeableContainer: {
      overflow: 'visible',
      // No backgroundColor — it would show through the row's anti-aliased edges.
    },

    childrenContainer: {
      overflow: 'hidden',
      borderRadius: theme.radii.xl,
      borderCurve: 'continuous',
    },

    // `flex: 1` fills the reveal wrapper's height, which the row stretches.
    actionsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.charade['950'],
      justifyContent: 'center',
      marginLeft: -theme.spacing.base, // Tucked under the row's edge
      paddingLeft: theme.spacing.base, // Compensate for margin to maintain button positioning
    },
    leftActionsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.charade['950'],
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginRight: -theme.spacing.base, // Tucked under the row's edge
      paddingRight: theme.spacing.base, // Compensate for margin to maintain button positioning
    },

    actionButton: {
      width: 50,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      zIndex: theme.zIndex.raised, // above the row content, for touch priority
    },

    circularActionButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: theme.spacing.xs,
      zIndex: theme.zIndex.raised, // above the row content, for touch priority
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.onPrimary,
      backgroundColor: 'transparent', // No fill - outlined style
    },

    deleteText: {
      // The label sits on the same `charade.950` underlay as the icon, not on
      // an error fill.
      color: theme.colors.onScrim,
      ...theme.type.label,
      marginTop: theme.spacing.xs,
    },
  };
});
