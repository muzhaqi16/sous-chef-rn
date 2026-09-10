import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';

import { StyleSheet } from 'react-native-unistyles';

interface AuthWrapperProps {
  children: ReactNode;
  testID?: string;
}

export const AuthWrapper = ({ children, testID }: AuthWrapperProps) => {
  return (
    <ThemedSafeAreaView style={styles.safeArea}>
      <ThemedKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner} testID={testID}>
          {children}
        </View>
      </ThemedKeyboardAwareScrollView>
    </ThemedSafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  inner: {
    // `flexGrow`, NOT `flex`: `flex: 1` sets a zero basis and pins this to the
    // viewport, so content taller than the screen overflows its own box instead
    // of scrolling — and a sibling laid out after a `flex: 1` child is drawn
    // over by that overflow, which is how the biometric button landed on top of
    // the submit button.
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
  },
}));
