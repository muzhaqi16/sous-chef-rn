import { useState } from 'react';
import { useScreenFocusEffect } from '#platform/screen';

/**
 * Whether the screen around the caller is focused, for a read that stands down
 * while its screen is hidden. Starts focused: tabs mount lazily, and a blurred
 * first render would fire a throwaway read.
 */
export function useIsScreenFocused(): boolean {
  const [isFocused, setIsFocused] = useState(true);
  const [onFocusChange] = useState(() => () => {
    setIsFocused(true);
    return () => setIsFocused(false);
  });
  useScreenFocusEffect(onFocusChange);
  return isFocused;
}
