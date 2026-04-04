import React from 'react';
import { View, RefreshControlProps, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Header } from '#components/molecules/Header';

interface ProfileScreenWrapperProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  testID?: string;
  scrollEnabled?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
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
  scrollEnabled = true,
  refreshControl,
}) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      testID={testID}
    >
      {!!showBackButton && (
        <Header title={title ?? ''} onBack={goBack} centerTitle />
      )}
      {scrollEnabled ? (
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollView}>{children}</View>
      )}
    </View>
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
