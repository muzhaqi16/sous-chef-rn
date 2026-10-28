import React from 'react';
import { useTranslation } from '#/i18n';
import Animated, {
  FadeIn,
  LinearTransition,
  withTiming,
  type LayoutAnimation,
} from 'react-native-reanimated';
import { IconButton } from '#components/atoms/IconButton';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ListItem } from '#components/molecules/ListItem';
import { SLIDE_PRESETS } from '#constants/animations';
import { motion } from '#/theme/motion';
import { QuickAddButton } from '#features/catalog/components/QuickAddButton';

export interface SuggestionListItemProps {
  imageUrl?: string | null;
  title: string;
  subtitle?: string | null;
  /** Adds the item; the whole row and its + both call it. */
  onQuickAdd: () => void;
  /** When provided, shows a muted ✕ control that dismisses this suggestion */
  onDismiss?: () => void;
  /** When false, the row shows no photo even when it has one */
  showImage?: boolean;
}

const EXIT_DISTANCE = SLIDE_PRESETS.exitWithFade.slideDistance;
const EXIT_OPACITY = SLIDE_PRESETS.exitWithFade.opacityTarget;
const EXIT_DURATION = SLIDE_PRESETS.exitWithFade.duration;

// `withTiming` reads the device's Reduce Motion setting itself.
const slideOutWithFade = (): LayoutAnimation => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(EXIT_OPACITY, { duration: EXIT_DURATION }),
      transform: [
        {
          translateX: withTiming(EXIT_DISTANCE, { duration: EXIT_DURATION }),
        },
      ],
    },
  };
};

const ENTERING = FadeIn.duration(motion.timing.FAST);
const LAYOUT = LinearTransition.duration(motion.timing.MODERATE);

/**
 * A suggestion row. It leaves when its suggestion leaves the data: the row
 * animates out as it unmounts and the rows below glide into its place, so no
 * render ever waits on the animation.
 */
export const SuggestionListItem = ({
  imageUrl,
  title,
  subtitle,
  onQuickAdd,
  onDismiss,
  showImage = true,
}: SuggestionListItemProps) => {
  const { t } = useTranslation();
  const addLabel = t('labels.addNamed', { name: title });

  return (
    <Animated.View
      entering={ENTERING}
      exiting={slideOutWithFade}
      layout={LAYOUT}
    >
      <RowCard>
        <ListItem
          title={title}
          subtitle={subtitle}
          leftElement={showImage ? <RowThumbnail uri={imageUrl} /> : null}
          onPress={onQuickAdd}
          // The tap adds, so the label says so and no "view details" follows.
          accessibilityLabel={addLabel}
          accessibilityHint=""
          rightElement={
            <>
              {!!onDismiss && (
                <IconButton
                  name="close"
                  size="sm"
                  tone="iconTertiary"
                  onPress={onDismiss}
                  accessibilityLabel={t('labels.dismissNamed', {
                    name: title,
                  })}
                />
              )}
              <QuickAddButton
                onPress={onQuickAdd}
                accessibilityLabel={addLabel}
              />
            </>
          }
        />
      </RowCard>
    </Animated.View>
  );
};
