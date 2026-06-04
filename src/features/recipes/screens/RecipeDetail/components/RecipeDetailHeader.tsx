import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ThemedBackButton,
} from '#components/atoms/themedComponents';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import TurboImage from 'react-native-turbo-image';
import { Icon } from '#utils/iconUtils';

const FavoriteActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.favorite,
}));

const AnimatedTurboImage = Animated.createAnimatedComponent(TurboImage);

interface RecipeDetailHeaderProps {
  imageUrl?: string | null;
  externalId?: string;
  scrollY: SharedValue<number>;
  onBack: () => void;
  showMealPlanButton: boolean;
  showEditButton: boolean;
  showFolderButton: boolean;
  showHeartButton: boolean;
  isInOtherFolder: boolean;
  isInFavorites: boolean;
  busy: boolean;
  onMealPlanPress: () => void;
  onEditPress: () => void;
  onFolderPress: () => void;
  onHeartPress: () => void;
}

export const RecipeDetailHeader: React.FC<RecipeDetailHeaderProps> = ({
  imageUrl,
  externalId,
  scrollY,
  onBack,
  showMealPlanButton,
  showEditButton,
  showFolderButton,
  showHeartButton,
  isInOtherFolder,
  isInFavorites,
  busy,
  onMealPlanPress,
  onEditPress,
  onFolderPress,
  onHeartPress,
}) => {
  const { t } = useTranslation();
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.get(),
      [0, 300],
      [1, 0.95],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  const actionButtons = (
    <>
      {!!showMealPlanButton && (
        <Pressable
          onPress={onMealPlanPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel={t('recipes.addToMealPlanA11y')}
        >
          <Icon name="calendar-outline" size={22} tone="primary" />
        </Pressable>
      )}
      {!!showEditButton && (
        <Pressable
          onPress={onEditPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Icon name="create-outline" size={22} tone="primary" />
        </Pressable>
      )}
      {!!showFolderButton && (
        <Pressable
          onPress={onFolderPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
          disabled={busy}
        >
          <Icon
            name={isInOtherFolder ? 'folder' : 'folder-outline'}
            size={22}
            tone="primary"
          />
        </Pressable>
      )}
      {!!showHeartButton && (
        <Pressable
          onPress={onHeartPress}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && { opacity: 0.7 },
          ]}
          disabled={busy}
        >
          {busy ? (
            <FavoriteActivityIndicator size="small" />
          ) : (
            <Icon
              name={isInFavorites ? 'heart' : 'heart-outline'}
              size={24}
              tone="favorite"
            />
          )}
        </Pressable>
      )}
    </>
  );

  if (imageUrl) {
    return (
      <View style={styles.imageContainer}>
        <AnimatedTurboImage
          source={{ uri: imageUrl }}
          cachePolicy="dataCache"
          resizeMode="cover"
          style={[styles.recipeImage, imageAnimatedStyle]}
          sharedTransitionTag={
            externalId ? `recipe-image-${externalId}` : undefined
          }
        />
        <ThemedBackButton onPress={onBack} style={styles.backButton} />
        <View style={styles.rightButtons}>{actionButtons}</View>
      </View>
    );
  }

  return (
    <View style={styles.noImageHeader}>
      <ThemedBackButton onPress={onBack} />
      <View style={styles.noImageRightButtons}>{actionButtons}</View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 300,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2.22,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.22)',
      },
    ],
  },
  rightButtons: {
    position: 'absolute',
    top: 48,
    right: 12,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2.22,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.22)',
      },
    ],
  },
  noImageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  noImageRightButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
}));
