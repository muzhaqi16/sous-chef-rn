import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { StatusBarScrim } from './StatusBarScrim';
import { HERO_IMAGE_HEIGHT } from './RecipeHeroImage';

const FavoriteActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.favorite,
}));

// Gap between the status bar and the floating header buttons.
export const HEADER_TOP_GAP = 8;
const BUTTON_SIZE = 40;
// Bar height below the status-bar inset (gap + button row + gap). Exported so the
// no-image branch in the screen can reserve matching space above the title.
export const BAR_CONTENT_HEIGHT = HEADER_TOP_GAP + BUTTON_SIZE + HEADER_TOP_GAP;

// Scroll offset (px) over which the solid bar fades in as the hero scrolls away.
const BG_FADE_START = HERO_IMAGE_HEIGHT * 0.5;
const BG_FADE_END = HERO_IMAGE_HEIGHT * 0.85;

interface RecipeDetailTopBarProps {
  scrollY: SharedValue<number>;
  hasImage: boolean;
  title: string;
  /** Mounted only while collapsed so the title text isn't duplicated with the
   * content card's title (also keeps it out of the a11y tree when expanded). */
  titleVisible: boolean;
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

/**
 * Pinned header for the Recipe Detail screen. Stays fixed while the hero image
 * scrolls away beneath it. When there's a photo the bar background is
 * transparent at rest (buttons float over the image, status-bar icons kept
 * legible by `StatusBarScrim`) and a solid app-colored bar + recipe title fade
 * in as you scroll. With no photo the bar is solid from the start.
 */
export const RecipeDetailTopBar: React.FC<RecipeDetailTopBarProps> = ({
  scrollY,
  hasImage,
  title,
  titleVisible,
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
  const insets = useSafeAreaInsets();

  const barBgStyle = useAnimatedStyle(() => {
    if (!hasImage) return { opacity: 1 };
    const opacity = interpolate(
      scrollY.get(),
      [BG_FADE_START, BG_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const titleStyle = useAnimatedStyle(() => {
    const start = hasImage ? 190 : 30;
    const end = hasImage ? 250 : 90;
    const opacity = interpolate(
      scrollY.get(),
      [start, end],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { height: insets.top + BAR_CONTENT_HEIGHT }]}
    >
      {!!hasImage && <StatusBarScrim />}
      <Animated.View
        pointerEvents="none"
        style={[styles.solidBg, barBgStyle]}
      />
      <View
        pointerEvents="box-none"
        style={[styles.row, { top: insets.top + HEADER_TOP_GAP }]}
      >
        <ThemedBackButton onPress={onBack} style={styles.backButton} />
        <Animated.View
          pointerEvents="none"
          style={[styles.titleWrap, titleStyle]}
        >
          {!!titleVisible && (
            <Text size="md" weight="semibold" numberOfLines={1}>
              {title}
            </Text>
          )}
        </Animated.View>
        <View style={styles.rightButtons}>{actionButtons}</View>
      </View>
    </View>
  );
};

const CIRCLE_SHADOW = [
  {
    offsetX: 0,
    offsetY: 1,
    blurRadius: 2.22,
    spreadDistance: 0,
    color: 'rgba(0, 0, 0, 0.22)',
  },
];

const styles = StyleSheet.create(theme => ({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  solidBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: BUTTON_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: CIRCLE_SHADOW,
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: CIRCLE_SHADOW,
  },
}));
