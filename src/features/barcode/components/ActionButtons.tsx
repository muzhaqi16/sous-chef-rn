import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/molecules/Button';

interface ActionButtonsProps {
  /**
   * Omit when there is no action to offer — the secondary action then stands
   * alone. Rendering a primary button that cannot do anything is worse than
   * rendering none.
   */
  primaryAction?: {
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
  secondaryAction: {
    label: string;
    onPress: () => void;
  };
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  primaryAction,
  alternateAction,
  secondaryAction,
}) => {
  return (
    <View style={styles.actionButtons}>
      {!!primaryAction && (
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
      )}

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

      <Button
        onPress={secondaryAction.onPress}
        variant="secondary"
        size="large"
        fullWidth
      >
        {secondaryAction.label}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  actionButtons: {
    gap: theme.spacing.md,
  },
}));
