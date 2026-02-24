import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { IconButton } from '../atoms/IconButton';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

interface ProfileScreenWrapperProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  testID?: string;
}

/**
 * Reusable wrapper for profile sub-screens
 * Provides consistent layout, styling, safe area handling, and back navigation
 */
export const ProfileScreenWrapper: React.FC<ProfileScreenWrapperProps> = ({
  children,
  title,
  showBackButton = true,
  testID,
}) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
      testID={testID}
    >
      {!!showBackButton && (
        <View style={styles.header}>
          <IconButton
            name="arrow-back"
            onPress={goBack}
            color={theme.colors.textPrimary}
            accessibilityLabel="Go back"
          />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <View style={styles.headerSpacer} />
        </View>
      )}
      <ScrollView style={styles.scrollView}>{children}</ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    flex: 1,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  headerSpacer: {
    width: 24, // Same width as IconButton to center the title
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
