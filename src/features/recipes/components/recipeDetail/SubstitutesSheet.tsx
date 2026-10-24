import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { Card } from '#components/atoms/Card';
import { Badge } from '#components/atoms/Badge';
import { Icon } from '#components/atoms/Icon';
import { StatusLine } from '#components/atoms/StatusLine';
import { Text } from '#components/atoms/Text';
import { householdAlertKey } from '#domain/dietary';
import type { SubstituteOption } from '#features/recipes/hooks/useRecipeSubstitutes';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface SubstitutesSheetProps {
  visible: boolean;
  ingredientName: string;
  options: SubstituteOption[];
  onDismiss: () => void;
}

/**
 * What can stand in for one ingredient: each swap's parts in the amount the
 * recipe needs, what the pantry holds of them, and how it changes the dish.
 */
export const SubstitutesSheet: React.FC<SubstitutesSheetProps> = ({
  visible,
  ingredientName,
  options,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onDismiss}
      enableDynamicSizing
      snapPoints={[]}
      title={t('recipes.substitutes.title', { name: ingredientName })}
    >
      <View style={styles.list} testID={recipesTestIDs.substitutesSheet}>
        {options.map(option => (
          <Card
            key={option.id}
            style={styles.option}
            testID={recipesTestIDs.substituteOption(option.id)}
          >
            {option.stock !== 'none' && (
              <Badge variant={option.stock === 'all' ? 'success' : 'warning'}>
                {option.stock === 'all'
                  ? t('recipes.substitutes.inPantry')
                  : t('recipes.substitutes.partlyInPantry')}
              </Badge>
            )}
            {option.parts.map(part => (
              <View key={part.key} style={styles.part}>
                <Icon
                  name={part.inPantry ? 'checkmark-circle' : 'ellipse-outline'}
                  size="sm"
                  tone={part.inPantry ? 'success' : 'iconSecondary'}
                />
                <Text role="body" style={styles.partText}>
                  {part.text}
                </Text>
              </View>
            ))}
            {!!option.per && (
              <Text role="caption" tone="secondary">
                {t('recipes.substitutes.per', {
                  amount: option.per,
                  name: ingredientName,
                })}
              </Text>
            )}
            {!!option.note && (
              <Text role="caption" tone="secondary">
                {option.note}
              </Text>
            )}
            {option.alerts.map(alert => (
              <StatusLine key={alert.id} tone="neutral">
                {t(householdAlertKey(alert), {
                  name: alert.memberName,
                  what: alert.what,
                })}
              </StatusLine>
            ))}
          </Card>
        ))}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing.sm,
  },
  option: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    alignItems: 'flex-start',
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  partText: {
    flexShrink: 1,
  },
}));
