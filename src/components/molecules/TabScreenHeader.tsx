import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { OfflineStatusPill } from '#components/molecules/OfflineStatusPill';
import { BarActions, type BarAction } from '#components/molecules/BarActions';
import { Text } from '#components/atoms/Text';
import { ExpandChevron } from '#components/atoms/ExpandChevron';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';

/** A title that names one of several things the user can switch between. */
export interface TitleSwitch {
  onPress: () => void;
  /** Turns the chevron while an inline picker shows. */
  open?: boolean;
  /** What pressing the title does, for a screen reader. */
  accessibilityHint?: string;
  testID?: string;
  /** Where the title sits, for a spotlight that points at it. */
  onMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

/** A tab's header holds its title and at most this many actions for the tab. */
const MAX_TAB_ACTIONS = 2;

interface TabScreenHeaderProps {
  title: string;
  actions?: readonly BarAction[];
  /** The title names one of several things: a chevron, and the picker it opens. */
  switchable?: TitleSwitch;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  title,
  actions,
  switchable,
}) => {
  if (__DEV__ && (actions?.length ?? 0) > MAX_TAB_ACTIONS) {
    throw new Error(
      `TabScreenHeader: ${actions?.length} actions on "${title}". A tab header holds at most ${MAX_TAB_ACTIONS}; move the rest into one of them, such as a ⋮ menu.`,
    );
  }

  const { ref: titleRef, measure: measureTitle } = useMeasuredRect(
    switchable?.onMeasure,
  );

  const titleContent = (
    <View
      ref={titleRef}
      collapsable={false}
      onLayout={measureTitle}
      style={styles.titleRow}
    >
      <Text
        role="title"
        style={styles.title}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      {!!switchable && (
        <ExpandChevron expanded={switchable.open ?? false} tone="textPrimary" />
      )}
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        {switchable ? (
          <Pressable
            style={styles.titleSwitch}
            onPress={switchable.onPress}
            accessibilityRole="button"
            accessibilityHint={switchable.accessibilityHint}
            testID={switchable.testID}
          >
            {titleContent}
          </Pressable>
        ) : (
          titleContent
        )}
      </View>

      {/* The offline pill renders null while online, so with no actions the
          group is simply empty. */}
      <BarActions
        leading={<OfflineStatusPill size={20} />}
        actions={actions}
        placement="gutter"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // No horizontal inset: this header renders inside its screen's list content
  // container, which owns the page gutter.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  leftContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  // Hugs the title and chevron, so the empty end of the bar opens nothing.
  titleSwitch: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  title: {
    flexShrink: 1,
  },
}));
