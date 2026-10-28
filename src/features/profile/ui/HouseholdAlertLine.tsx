import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Badge } from '#components/atoms/Badge';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  alertSeverityLabelKey,
  householdAlertReasonKey,
  isStrictSeverity,
  type HouseholdAlert,
} from '#domain/dietary';

interface HouseholdAlertLineProps {
  alert: HouseholdAlert;
  testID?: string;
}

/**
 * One member's alert: who, how serious (the word their profile picked), and
 * why. An allergy or intolerance is red; an avoided food or a diet, amber.
 */
export const HouseholdAlertLine: React.FC<HouseholdAlertLineProps> = ({
  alert,
  testID,
}) => {
  const { t } = useTranslation();
  const strict = isStrictSeverity(alert.severity);
  const severityKey = alertSeverityLabelKey(alert);

  return (
    <View style={styles.line} testID={testID}>
      <Icon
        name={strict ? 'alert-circle' : 'warning-outline'}
        size="sm"
        tone={strict ? 'danger' : 'warning'}
      />
      <View style={styles.text}>
        <View style={styles.who}>
          <Text role="bodyStrong" style={styles.name}>
            {alert.memberName}
          </Text>
          {!!severityKey && (
            <Badge variant={strict ? 'danger' : 'warning'}>
              {t(severityKey)}
            </Badge>
          )}
        </View>
        <Text role="body" tone="secondary">
          {t(householdAlertReasonKey(alert), { what: alert.what })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  text: {
    flex: 1,
    gap: theme.spacing['2xs'],
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  name: {
    flexShrink: 1,
  },
}));
