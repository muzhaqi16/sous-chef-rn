import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/molecules/Button';

interface ActionButtonsProps {
  primaryAction: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  /** Another way to do the primary action, shown under it, quieter. */
  alternateAction?: {
    label: string;
    onPress: () => void;
  };
}

/** The scan's add, drawn where its destination is described. */
export const ActionButtons: React.FC<ActionButtonsProps> = ({
  primaryAction,
  alternateAction,
}) => {
  return (
    <View style={styles.actionButtons}>
      <Button
        onPress={primaryAction.onPress}
        variant="primary"
        size="large"
        fullWidth
        disabled={primaryAction.disabled}
        loading={primaryAction.loading}
      >
        {primaryAction.label}
      </Button>

      {!!alternateAction && (
        <Button
          onPress={alternateAction.onPress}
          variant="ghost"
          size="large"
          fullWidth
        >
          {alternateAction.label}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  actionButtons: {
    gap: theme.spacing.sm,
  },
}));
