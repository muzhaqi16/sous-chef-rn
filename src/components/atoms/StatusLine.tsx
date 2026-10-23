import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextRole, type TextTone } from '#components/atoms/Text';

/** How urgent a row's status is; the line is the row's only status signal. */
export type StatusTone = 'neutral' | 'error' | 'warning' | 'info' | 'pending';

const LOOK: Record<
  StatusTone,
  { role: TextRole; tone: TextTone; italic: boolean }
> = {
  neutral: { role: 'footnote', tone: 'secondary', italic: false },
  error: { role: 'footnoteStrong', tone: 'error', italic: false },
  warning: { role: 'footnoteStrong', tone: 'warning', italic: false },
  info: { role: 'footnoteStrong', tone: 'info', italic: false },
  pending: { role: 'footnote', tone: 'secondary', italic: true },
};

interface StatusLineProps {
  tone: StatusTone;
  children: string;
  testID?: string;
}

/** The line under a row's title that says what state the row is in. */
export const StatusLine: React.FC<StatusLineProps> = ({
  tone,
  children,
  testID,
}) => {
  const look = LOOK[tone];
  return (
    <Text
      role={look.role}
      tone={look.tone}
      style={look.italic ? styles.pending : undefined}
      numberOfLines={1}
      testID={testID}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  pending: {
    fontStyle: 'italic',
  },
});
