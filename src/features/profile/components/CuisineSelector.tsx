import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import type { Cuisine } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { CuisineChips } from '#features/recipes/ui/CuisineChips';

type CuisineSelectorProps = {
  selectedCuisines: Cuisine[];
  onAdd: (cuisine: Cuisine) => Promise<boolean>;
  onRemove: (cuisine: Cuisine) => void;
};

export const CuisineSelector: React.FC<CuisineSelectorProps> = ({
  selectedCuisines,
  onAdd,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);

  const handleToggleCuisine = async (cuisine: Cuisine) => {
    if (isAdding) return;
    if (selectedCuisines.includes(cuisine)) {
      onRemove(cuisine);
    } else {
      setIsAdding(true);
      const success = await onAdd(cuisine);
      setIsAdding(false);
      if (!success) {
        alertService.alert(t('labels.error'), t('cuisineSelector.addFailed'));
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text role="bodyStrong" tone="secondary">
        {t('cuisineSelector.title')}
      </Text>
      <Text role="body" tone="secondary" style={styles.subtitle}>
        {t('cuisineSelector.subtitle')}
      </Text>
      <CuisineChips
        selected={selectedCuisines}
        onToggle={handleToggleCuisine}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
}));
