import type React from 'react';
import type { ThemedTextInputRef } from './themedComponents';

/**
 * What a host that moves focus between fields needs of a text input, whichever
 * of React Native's or gorhom's it is: react-hook-form's `field.ref`, which
 * `setFocus` and a failed submit's focus go through, is one.
 */
export type FocusableInputRef = Pick<ThemedTextInputRef, 'focus' | 'blur'>;

/** Hands an input instance to a ref of either kind, from a callback ref. */
export function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
