import type { ReactNode } from 'react';
import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '#components/templates/Screen';

interface AuthWrapperProps {
  children: ReactNode;
  testID?: string;
  /** Shows the standard header's back control; a root auth screen has none. */
  onBack?: () => void;
}

export const AuthWrapper = ({ children, testID, onBack }: AuthWrapperProps) => (
  <Screen
    scroll="form"
    testID={testID}
    header={onBack ? { back: onBack } : { variant: 'none' }}
  >
    <View style={styles.inner}>{children}</View>
  </Screen>
);

const styles = StyleSheet.create({
  inner: {
    // `flexGrow`, NOT `flex`: `flex: 1` sets a zero basis and pins this to the
    // viewport, so content taller than the screen overflows its own box instead
    // of scrolling — and a sibling laid out after a `flex: 1` child is drawn
    // over by that overflow, which is how the biometric button landed on top of
    // the submit button.
    flexGrow: 1,
  },
});
