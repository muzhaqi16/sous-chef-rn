import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { rowType } from '#/theme/foundations/type';

/** A trailing icon button on a recipe row. */
export interface RecipeCardAction {
  key: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  tone: React.ComponentProps<typeof Icon>['tone'];
  /** i18n key for the accessibility label, resolved here. */
  labelKey: string;
  onPress: () => void;
}

interface RecipeCardViewProps {
  name: string;
  imageUrl?: string | null;
  servings: number;
  /** Total minutes, or null to omit the time entirely. */
  totalMinutes: number | null;
  onPress: () => void;
  actions?: RecipeCardAction[];
}

/**
 * The recipe row, with no knowledge of where its data came from. `MyRecipeCard`
 * and `SavedRecipeCard` are thin fragment readers over it.
 */
export const RecipeCardView: React.FC<RecipeCardViewProps> = ({
  name,
  imageUrl,
  servings,
  totalMinutes,
  onPress,
  actions,
}) => {
  const { t } = useTranslation();

  return (
    <AppPressable
      onPress={onPress}
      accessibilityLabel={name}
      style={[
        commonStyles.rowWrapper,
        commonStyles.rowSurface,
        commonStyles.rowContent,
      ]}
    >
      {!!imageUrl && (
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage
            uri={imageUrl}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text role={rowType.title} numberOfLines={1}>
          {name}
        </Text>
        <Text
          role={rowType.subtitle}
          tone="secondary"
          numberOfLines={1}
          style={commonStyles.rowTextGap}
        >
          {t('recipes.servingsCount', { count: servings })}
          {totalMinutes != null
            ? ` • ${t('labels.min', { count: totalMinutes })}`
            : ''}
        </Text>
      </View>
      {!!actions?.length && (
        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityLabel={t(action.labelKey)}
            >
              <Icon name={action.icon} size={20} tone={action.tone} />
            </Pressable>
          ))}
        </View>
      )}
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
