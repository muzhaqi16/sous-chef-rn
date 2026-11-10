import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';

interface InlineTourHintProps {
  text: string;
  stepIndex: number;
  totalSteps: number;
  /** "Not now": the guide waits for a later session. */
  onClose: () => void;
  /** "End tour": every step counts as shown. */
  onEnd: () => void;
  testID?: string;
}

/**
 * A guide's step shown where it happens (in a sheet, or on a screen whose
 * action is a step away) instead of a spotlight. It continues on the action,
 * so it has no Next.
 */
export const InlineTourHint = ({
  text,
  stepIndex,
  totalSteps,
  onClose,
  onEnd,
  testID,
}: InlineTourHintProps) => {
  const { t } = useTranslation();
  const progress = t('tutorial.stepOf', {
    step: stepIndex + 1,
    total: totalSteps,
  });
  return (
    <View style={styles.container} testID={testID}>
      <View
        style={styles.content}
        accessible
        accessibilityLabel={`${progress}. ${text}`}
      >
        <View style={styles.iconCircle}>
          <Icon name="hand-left-outline" size={16} tone="onPrimary" />
        </View>
        <View style={styles.text}>
          <Text role="caption" tone="secondary">
            {progress}
          </Text>
          <Text role="label">{text}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onClose}
          style={styles.action}
          accessibilityRole="button"
        >
          <Text role="label" tone="secondary">
            {t('labels.notNow')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onEnd}
          style={styles.action}
          accessibilityRole="button"
        >
          <Text role="label" tone="secondary">
            {t('tutorial.endTour')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingTop: theme.spacing.smPlus,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: theme.spacing.xs,
  },
  action: {
    minHeight: theme.sizes.touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
}));
