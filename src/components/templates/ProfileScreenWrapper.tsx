import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Header } from '#components/molecules/Header';

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
        <Header title={title ?? ''} onBack={goBack} centerTitle />
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
  scrollView: {
    flex: 1,
  },
}));
