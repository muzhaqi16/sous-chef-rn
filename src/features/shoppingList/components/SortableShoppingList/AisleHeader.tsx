import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { useTranslation } from '#/i18n';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import type { AisleHeaderRow } from './types';

/** The heading over one aisle's lines, with how many it holds. */
export const AisleHeader: React.FC<{ aisle: AisleHeaderRow }> = ({ aisle }) => {
  const { t } = useTranslation();
  return (
    <View
      style={styles.header}
      accessibilityRole="header"
      testID={shoppingListTestIDs.aisleHeader(aisle.department)}
    >
      <SectionHeader variant="overline">
        {t(`shoppingListScreens.aisles.department.${aisle.department}`)}
      </SectionHeader>
      <Text role="footnote" tone="tertiary">
        {aisle.count}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
}));
