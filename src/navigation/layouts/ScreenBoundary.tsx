import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { SharedTransitionBoundary } from 'react-native-reanimated';

/**
 * Marks where a screen is for Reanimated's shared element transitions: a
 * transition flies between the tagged views of the active boundary and the
 * one becoming active. One per leaf screen, never around a navigator, or the
 * nested screens' tags pair with the wrong boundary.
 */
export function ScreenBoundary({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  return (
    <SharedTransitionBoundary isActive={isFocused}>
      {children}
    </SharedTransitionBoundary>
  );
}
