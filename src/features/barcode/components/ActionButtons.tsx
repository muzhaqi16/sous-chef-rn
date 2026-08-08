import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/base/Button';

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
  secondaryAction: {
    label: string;
    onPress: () => void;
  };
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  primaryAction,
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
