import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { Card } from '#components/atoms/Card';
import { Badge } from '#components/atoms/Badge';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { strictestFirst, type HouseholdAlert } from '#domain/dietary';
import { HouseholdAlertLine } from '#features/profile/ui/HouseholdAlertLine';
import type { SubstituteOption } from '#features/recipes/hooks/useRecipeSubstitutes';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface IngredientAlertsSheetProps {
  visible: boolean;
  ingredientName: string;
  /** Who in the household it affects. */
  alerts: HouseholdAlert[];
  /** The answer is from earlier: offline, it may be out of date. */
  stale: boolean;
  /** What can stand in for it; none offers no swaps. */
  options: SubstituteOption[];
  isAdded: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}

/**
 * A flagged ingredient, opened from its tile: each member it affects and how,
 * then what can stand in for it (each swap's parts in the amount the recipe
 * needs, what the pantry holds of them, how it changes the dish), then adding
 * it anyway. One sheet, so no second modal races the backdrop.
 */
export const IngredientAlertsSheet: React.FC<IngredientAlertsSheetProps> = ({
  visible,
  ingredientName,
  alerts,
  stale,
  options,
  isAdded,
  onAdd,
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
      title={ingredientName}
    >
      <View style={styles.body} testID={recipesTestIDs.ingredientSheet}>
        <Text role="body" tone="secondary">
          {t('recipes.ingredientAlerts.lead')}
        </Text>
        <Card style={styles.alerts}>
          {strictestFirst(alerts).map(alert => (
            <HouseholdAlertLine key={alert.id} alert={alert} />
          ))}
        </Card>
        {stale ? (
          <Text role="caption" tone="secondary">
            {t('dietaryAlerts.stale')}
          </Text>
        ) : null}
        <Text role="caption" tone="tertiary">
          {t('dietaryAlerts.checkLabel')}
        </Text>
        {options.length > 0 && (
          <View style={styles.list}>
            <Text role="heading">
              {t('recipes.substitutes.title', { name: ingredientName })}
            </Text>
            {options.map(option => (
              <Card
                key={option.id}
                style={styles.option}
                testID={recipesTestIDs.substituteOption(option.id)}
              >
                {option.stock !== 'none' && (
                  <Badge
                    variant={option.stock === 'all' ? 'success' : 'warning'}
                  >
                    {option.stock === 'all'
                      ? t('recipes.substitutes.inPantry')
                      : t('recipes.substitutes.partlyInPantry')}
                  </Badge>
                )}
                {option.parts.map(part => (
                  <View key={part.key} style={styles.part}>
                    <Icon
                      name={
                        part.inPantry ? 'checkmark-circle' : 'ellipse-outline'
                      }
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
                {strictestFirst(option.alerts).map(alert => (
                  <HouseholdAlertLine key={alert.id} alert={alert} />
                ))}
              </Card>
            ))}
          </View>
        )}
        <Button
          variant={isAdded ? 'outline' : 'primary'}
          icon={isAdded ? 'checkmark' : 'add'}
          onPress={onAdd}
          disabled={isAdded}
          fullWidth
          testID={recipesTestIDs.ingredientSheetAdd}
        >
          {isAdded ? t('labels.added') : t('labels.addToShoppingList')}
        </Button>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.spacing.md,
  },
  alerts: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
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
