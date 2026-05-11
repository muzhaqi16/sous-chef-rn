import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { BackButton } from '#components/atoms/BackButton';
import { Text } from '#components/atoms/Text';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
  backButtonColor?: string;
  backButtonDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ThemedBackButton = withUnistyles(BackButton);

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightElement,
  backButtonColor,
  backButtonDisabled,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <ThemedBackButton
        onPress={onBack}
        uniProps={t => ({ color: backButtonColor ?? t.colors.textPrimary })}
        disabled={backButtonDisabled}
      />
      <Text size="lg" weight="semibold" align="center" style={styles.title}>
        {title}
      </Text>
      {rightElement ?? <View style={styles.placeholder} />}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    flex: 1,
  },
  placeholder: {
    width: 24,
  },
}));
