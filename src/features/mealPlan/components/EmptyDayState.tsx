import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
import { Text } from '#components/atoms/Text';
import { type MealType } from '#/graphql/generated/schemaTypes';

interface EmptyDayStateProps {
  selectedDate: Date;
  onAddMeal?: (mealType?: MealType) => void;
}

export const EmptyDayState: React.FC<EmptyDayStateProps> = ({
  selectedDate,
  onAddMeal,
}) => {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingBottom: getTabBarBottomPadding(safeBottom) },
      ]}
    >
      <Icon name="restaurant-outline" size={48} tone="textTertiary" />
      <Text size="lg" weight="semibold" style={styles.title}>
        {t('emptyDay.title')}
      </Text>
      <Text size="sm" tone="secondary" style={styles.subtitle}>
        {format(selectedDate, 'EEEE, MMMM d')}
      </Text>
      {!!onAddMeal && (
        <Pressable
          onPress={() => onAddMeal()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Icon name="add" size={20} tone="white" />
          <Text size="md" weight="semibold" style={styles.buttonText}>
            {t('emptyDay.addMeal')}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

EmptyDayState.displayName = 'EmptyDayState';

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  buttonText: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.white,
  },
}));
