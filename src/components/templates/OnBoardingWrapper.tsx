import React, {ReactNode} from 'react';
import {
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import FeatherIcon from '@react-native-vector-icons/feather';

interface OnboardingWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  step?: number; // current step index (1-based)
  totalSteps?: number;
  onBack?: () => void;
  onSkip?: () => void;
}

export const OnBoardingWrapper = ({
  children,
  title,
  subtitle,
  step,
  totalSteps,
  onBack,
  onSkip,
}: OnboardingWrapperProps) => {
  const {styles, theme} = useStyles(stylesheet);

  const progress = step && totalSteps ? (step / totalSteps) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            <FeatherIcon
              name="arrow-left"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled">
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
      {onSkip && (
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
      {step != null && totalSteps != null && (
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, {width: `${progress}%`}]} />
        </View>
      )}
    </SafeAreaView>
  );
};

const stylesheet = createStyleSheet(theme => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  skipButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
    marginHorizontal: 16,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
}));
