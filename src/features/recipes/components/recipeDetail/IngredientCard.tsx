import React from 'react';
import { View } from 'react-native';
import { useMoney } from '#/domain/money';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { getSpoonacularIngredientImageUrl } from '#/services/spoonacular/utils';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { preferredMeasure } from '#features/recipes/utils/preferredMeasure';
import type { UnitSystem } from '#/graphql/generated/schemaTypes';
import { Card } from '#components/atoms/Card';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';

interface IngredientCardProps {
  ingredient: DisplayIngredient;
  isAdded: boolean;
  onPress: () => void;
  /** The reader's preferred system. Only a not-yet-imported recipe can honour
   *  it: a persisted ingredient carries the one unit the server resolved. */
  unitSystem: UnitSystem;
}

// Backend ingredients carry the GraphQL `__typename`; Spoonacular's REST
// `extendedIngredient` shape does not — use that to discriminate the union.
const isBackendIngredient = (
  ingredient: DisplayIngredient,
): ingredient is Extract<
  DisplayIngredient,
  { __typename: 'RecipeIngredient' }
> => '__typename' in ingredient;

export const IngredientCard: React.FC<IngredientCardProps> = ({
  ingredient,
  isAdded,
  onPress,
  unitSystem,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const isBackend = isBackendIngredient(ingredient);
  const ingredientName = ingredient.name || t('labels.unknown');
  // Both sources answer in the reader's own system. A persisted ingredient is
  // converted by the server, the only side holding the unit table; a
  // not-yet-imported one already carries both of Spoonacular's measures. Each
  // falls back to what it stores when its conversion is unavailable.
  const converted = isBackend ? ingredient.convertedQuantity : null;
  const measure = isBackend
    ? null
    : preferredMeasure(ingredient.measures, unitSystem);
  const amount = isBackend
    ? converted?.value ?? ingredient.quantity
    : measure?.amount ?? ingredient.amount;
  // A zero amount is an unmeasured ingredient ("salt to taste"): show none.
  const quantity = amount ? formatQuantityForDisplay(amount) : '';
  const unitSymbol = isBackend
    ? firstNonBlank(converted?.unit.symbol, ingredient.unit?.symbol)
    : measure?.unit;
  const unit = unitSymbol ?? '';
  // Backend-only: the estimated ingredient price (US dollars), surfaced on its
  // own line. Never derived from the name — only the dedicated field is shown.
  const estimatedPrice = isBackend ? ingredient.estimatedPrice : null;
  const imageUrl = ingredient.image
    ? ingredient.image.startsWith('http')
      ? ingredient.image // Already full URL from backend
      : getSpoonacularIngredientImageUrl(ingredient.image) // Filename needs URL
    : isBackend
    ? ingredient.item?.imageUrl
    : undefined;

  return (
    <Card
      elevation="sm"
      padding="sm"
      style={styles.card}
      onPress={onPress}
      disabled={isAdded}
    >
      {imageUrl ? (
        <CachedImage uri={imageUrl} style={styles.image} displaySize={64} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Icon name="leaf-outline" size={32} tone="textSecondary" />
        </View>
      )}
      <Text
        role="caption"
        tone="secondary"
        style={styles.quantity}
        numberOfLines={1}
      >
        {quantity} {unit}
      </Text>
      <Text role="label" align="center" numberOfLines={2}>
        {ingredientName}
      </Text>
      {estimatedPrice != null ? (
        <Text
          role="label"
          tone="accent"
          align="center"
          style={styles.price}
          numberOfLines={1}
        >
          {money(estimatedPrice)}
        </Text>
      ) : null}
      {isAdded ? (
        <View style={styles.addedBadge}>
          <Icon name="checkmark" size={12} tone="onSuccess" />
        </View>
      ) : (
        <View style={styles.addButton}>
          <Icon name="add" size={16} tone="primary" />
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    width: 100,
    alignItems: 'center',
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    marginBottom: theme.spacing['2xs'],
  },
  price: {
    marginTop: theme.spacing['2xs'],
  },
  addedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
