import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { useRestrictionsNote } from '#features/recipes/hooks/useRestrictionsNote';

interface RestrictionsNoteProps {
  homeId: string | null | undefined;
  /** Opens the Dietary Profile; absent where it cannot be reached. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * What a list of recipe suggestions honors, such as "Vegetarian • No peanut",
 * so the user sees their answers at work. Nothing with no restriction held.
 */
export const RestrictionsNote = ({
  homeId,
  onPress,
  style,
  testID,
}: RestrictionsNoteProps) => {
  const { t } = useTranslation();
  const note = useRestrictionsNote(homeId);
  if (!note) return null;

  const content = (
    <View style={styles.row}>
      <Icon name="nutrition-outline" size="sm" tone="textSecondary" />
      <Text
        role="caption"
        tone="secondary"
        numberOfLines={1}
        style={styles.text}
      >
        {note}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <AppPressable
      style={style}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={t('recipes.restrictionsNoteHint')}
      testID={testID}
    >
      {content}
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  text: {
    flexShrink: 1,
  },
}));
