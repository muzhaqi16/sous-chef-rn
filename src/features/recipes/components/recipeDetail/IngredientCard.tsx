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
import { Card } from '#components/atoms/Card';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';

interface IngredientCardProps {
  ingredient: DisplayIngredient;
  isAdded: boolean;
  onPress: () => void;
}

export const IngredientCard: React.FC<IngredientCardProps> = ({
  ingredient,
  isAdded,
  onPress,
}) => {
  const { t } = useTranslation();
  const money = useMoney();
  const ingredientName = ingredient.name || t('labels.unknown');
  // The server converts to the reader's own system; the stored pair is the
  // fallback when no unit of that system shares the ingredient's dimension.
  const converted = ingredient.convertedQuantity;
  const amount = converted?.value ?? ingredient.quantity;
  // A zero amount is an unmeasured ingredient ("salt to taste"): show none.
  const quantity = amount ? formatQuantityForDisplay(amount) : '';
  const unitSymbol = firstNonBlank(
    converted ? converted.unit.symbol : null,
    ingredient.unit?.symbol,
  );
  const unit = unitSymbol ?? '';
  // US dollars, null until the recipe is first saved. Never derived from the name.
  const estimatedPrice = ingredient.estimatedPrice;
  const imageUrl = ingredient.image
    ? ingredient.image.startsWith('http')
      ? ingredient.image
      : getSpoonacularIngredientImageUrl(ingredient.image) // A bare filename
    : ingredient.item?.imageUrl;

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
}));
