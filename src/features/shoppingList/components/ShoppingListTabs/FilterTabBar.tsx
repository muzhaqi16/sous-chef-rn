import React from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { NavigationState, Route } from 'react-native-tab-view';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs/types';
import { FilterTabItem } from './FilterTabItem';
import { Text } from '#components/atoms/Text';

interface FilterTabBarRoute extends Route {
  key: string;
  title: string;
}

interface FilterTabBarProps {
  navigationState: NavigationState<FilterTabBarRoute>;
  jumpTo: (key: string) => void;
  counts?: Record<string, number>;
  actionButtons?: FilterTabActionButton[];
  testIDPrefix?: string;
  /** Optional: measure a specific tab's rect for tutorial spotlight */
  onTabMeasure?: (
    key: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  /** Which tab key(s) should be measured */
  measureTabKeys?: string[];
}

const FilterTabBarComponent: React.FC<FilterTabBarProps> = ({
  navigationState,
  jumpTo,
  counts,
  actionButtons,
  testIDPrefix = 'filter-tab',
  onTabMeasure,
  measureTabKeys,
}) => {
  const handleTabPress = (key: string) => {
    jumpTo(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {navigationState.routes.map((route, index) => (
          <FilterTabItem
            key={route.key}
            routeKey={route.key}
            title={route.title}
            isActive={navigationState.index === index}
            count={counts?.[route.key]}
            onPress={() => handleTabPress(route.key)}
            testID={`${testIDPrefix}-${route.key}`}
            onMeasure={
              onTabMeasure && measureTabKeys?.includes(route.key)
                ? rect => onTabMeasure(route.key, rect)
                : undefined
            }
          />
        ))}
      </ScrollView>
      {!!actionButtons?.length && (
        <View style={styles.actionsRow}>
          {actionButtons.map((btn, idx) => (
            <Pressable
              key={btn.testID || `${testIDPrefix}-action-${idx}`}
              onPress={btn.disabled ? undefined : btn.onPress}
              testID={btn.testID || `${testIDPrefix}-action-${idx}`}
              style={[
                btn.label ? styles.actionLabelButton : styles.actionButton,
                !btn.label && styles.actionButtonWithBg,
                btn.disabled && styles.actionDisabled,
              ]}
            >
              {btn.label ? (
                <Text size="sm" weight="semibold" tone="accent">
                  {btn.label}
                </Text>
              ) : btn.icon ? (
                <Icon
                  name={btn.icon}
                  size={20}
                  tone="primary"
                  library={btn.iconLibrary}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

export const FilterTabBar = FilterTabBarComponent;
FilterTabBar.displayName = 'FilterTabBar';

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: theme.spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
  },
  actionButtonWithBg: {
    backgroundColor: theme.colors.filterTab.inactiveBg,
  },
  actionLabelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  actionDisabled: {
    opacity: 0.4,
  },
}));
