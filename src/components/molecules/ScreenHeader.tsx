import React from 'react';
import { View, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BackButton } from '#components/atoms/BackButton';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
  backButtonColor?: string;
  backButtonDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightElement,
  backButtonColor,
  backButtonDisabled,
  style,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.container, style]}>
      <BackButton
        onPress={onBack}
        color={backButtonColor ?? theme.colors.textPrimary}
        disabled={backButtonDisabled}
      />
      <Text style={styles.title}>{title}</Text>
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
}));
