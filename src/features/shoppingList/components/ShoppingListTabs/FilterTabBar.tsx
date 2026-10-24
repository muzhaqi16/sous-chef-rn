import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import type { NavigationState, Route } from 'react-native-tab-view';
import type { FilterTabActionButton } from '#components/organisms/FilterTabs/types';
import { ModeTabs } from '#components/molecules/ModeTabs';
import { IconButton } from '#components/atoms/IconButton';
import { Text } from '#components/atoms/Text';
import { kitTestIDs } from '#components/testIDs';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';

interface FilterTabBarRoute<TKey extends string> extends Route {
  key: TKey;
  title: string;
}

interface FilterTabBarProps<TKey extends string> {
  navigationState: NavigationState<FilterTabBarRoute<TKey>>;
  jumpTo: (key: TKey) => void;
  counts?: Partial<Record<TKey, number>>;
  actionButtons?: FilterTabActionButton[];
  /** Optional: measure a specific tab's rect for tutorial spotlight */
  onTabMeasure?: (
    key: TKey,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  /** Which tab key(s) should be measured */
  measureTabKeys?: TKey[];
}

export function FilterTabBar<TKey extends string>({
  navigationState,
  jumpTo,
  counts,
  actionButtons,
  onTabMeasure,
  measureTabKeys,
}: FilterTabBarProps<TKey>) {
  const { routes, index } = navigationState;
  const titleOf = (key: TKey) =>
    routes.find(route => route.key === key)?.title ?? key;
  const current = routes[index]?.key;
  if (current === undefined) return null;

  // A mode switch, so tabs, not filter chips: the two are the list's two views,
  // not narrowings of one.
  return (
    <View style={styles.container}>
      <ModeTabs<TKey>
        options={routes.map(route => route.key)}
        value={current}
        onChange={jumpTo}
        formatLabel={titleOf}
        countOf={counts ? key => counts[key] : undefined}
        tabTestID={key =>
          kitTestIDs.filterTab(shoppingListTestIDs.tabBarPrefix, key)
        }
        onTabLayout={
          onTabMeasure
            ? (key, rect) => {
                if (measureTabKeys?.includes(key)) onTabMeasure(key, rect);
              }
            : undefined
        }
        trailing={actionButtons?.map((btn, idx) => {
          const testID = btn.testID ?? shoppingListTestIDs.tabBarAction(idx);
          return btn.label === undefined ? (
            <IconButton
              key={testID}
              name={btn.icon}
              library={btn.iconLibrary}
              tone="primary"
              onPress={btn.onPress}
              disabled={btn.disabled}
              accessibilityLabel={btn.accessibilityLabel}
              testID={testID}
            />
          ) : (
            <Pressable
              key={testID}
              onPress={btn.onPress}
              disabled={btn.disabled}
              testID={testID}
              accessibilityRole="button"
              accessibilityLabel={btn.accessibilityLabel}
              accessibilityState={{ disabled: !!btn.disabled }}
              style={[styles.textAction, btn.disabled && styles.disabled]}
            >
              <Text role="label" tone="accent">
                {btn.label}
              </Text>
            </Pressable>
          );
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.layout.pageGutter,
    marginBottom: theme.spacing.sm,
  },
  textAction: {
    justifyContent: 'center',
    minHeight: theme.sizes.touchTarget.md,
    paddingHorizontal: theme.spacing.sm,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
}));
