import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { IconButton } from '#components/atoms/IconButton';

interface HeaderProps {
  title: string;
  onBackPress: () => void;
  onScanPress: () => void;
  showScanButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBackPress,
  onScanPress,
  showScanButton = true,
}) => {
  return (
    <View style={styles.header}>
      <IconButton name="arrow-back" onPress={onBackPress} size={24} />
      <Text style={styles.headerTitle}>{title}</Text>
      {showScanButton ? (
        <IconButton name="qr-code-scanner" onPress={onScanPress} size={24} />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  placeholder: {
    width: 24,
    height: 24,
  },
}));
