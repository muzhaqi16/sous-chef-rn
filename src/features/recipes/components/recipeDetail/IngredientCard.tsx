import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { getSpoonacularIngredientImageUrl } from '#/services/spoonacular/utils';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { Card } from '#components/atoms/Card';

interface IngredientCardProps {
  ingredient: DisplayIngredient;
  isAdded: boolean;
  onPress: () => void;
}

// Backend ingredients carry the GraphQL `__typename`; Spoonacular's REST
// `extendedIngredient` shape does not — use that to discriminate the union.
const isBackendIngredient = (
  ingredient: DisplayIngredient,
): ingredient is Extract<
  DisplayIngredient,
  { __typename: 'RecipeIngredient' }
> => '__typename' in ingredient && ingredient.__typename === 'RecipeIngredient';

export const IngredientCard: React.FC<IngredientCardProps> = ({
  ingredient,
  isAdded,
  onPress,
}) => {
  const { t } = useTranslation();
  const isBackend = isBackendIngredient(ingredient);
  const ingredientName = ingredient.name || t('labels.unknown');
  const quantity = (isBackend ? ingredient.quantity : ingredient.amount) || '';
  const unit = isBackend
    ? ingredient.unit?.symbol || ''
    : ingredient.measures?.us?.unitShort || '';
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
      {estimatedPrice != null && estimatedPrice > 0 ? (
        <Text
          role="label"
          tone="accent"
          align="center"
          style={styles.price}
          numberOfLines={1}
        >
          {formatCurrency(estimatedPrice, DEFAULT_CURRENCY)}
        </Text>
      ) : null}
      {isAdded ? (
        <View style={styles.addedBadge}>
          <Icon name="checkmark" size={12} tone="onPrimary" />
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
    marginBottom: 2,
  },
  price: {
    marginTop: 2,
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
