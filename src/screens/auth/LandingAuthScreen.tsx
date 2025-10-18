import React from 'react';
import { View, Image, Text, TouchableOpacity, Linking } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AuthWrapper, Button } from '#components';
import { useSafeNavigation } from '#hooks';
import { getWebAppUrl } from '#utils/environment';

export function LandingAuthScreen() {
  const { navigation } = useSafeNavigation();

  return (
    <AuthWrapper>
      {/* 1. Hero image flex-zone */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.hero}
          resizeMode="contain"
        />
      </View>

      {/* 2. Content flex-zone */}
      <View style={styles.content}>
        <Text style={styles.title}>End Waste, Save Time & Money</Text>
        <Text style={styles.subtitle}>
          Know what you have, plan what’s next, and shop smarter every time.
        </Text>

        <View style={styles.buttons}>
          <Button
            title="Let's get started"
            onPress={() => navigation.navigate('SignUp')}
            btnStyle={styles.primaryBtn}
          />
          <Button
            title="I already have an account"
            onPress={() => navigation.navigate('Login')}
            btnStyle={styles.secondaryBtn}
            variant="secondary"
            txtStyle={styles.secondaryBtnText}
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            Linking.openURL(getWebAppUrl('/privacy-policy')).catch(err =>
              console.error('Failed to open URL:', err),
            );
          }}
        >
          <Text style={styles.footerText}>
            By continuing, you agree to our{'\n'}
            <Text style={styles.link}>Terms & Conditions</Text> and{' '}
            <Text style={styles.link}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>
      </View>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: 300,
    height: 300,
  },

  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    alignItems: 'center',
  },

  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.fonts.size.md,
    lineHeight: theme.spacing.lg,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  buttons: {
    width: '100%',
    marginTop: theme.spacing.xl,
  },
  primaryBtn: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },

  secondaryBtn: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.md,
  },
  secondaryBtnText: {
    color: theme.colors.primary,
  },

  footerText: {
    fontSize: theme.fonts.size.sm,
    lineHeight: theme.fonts.size.md * 1.5,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  link: {
    color: theme.colors.textOnSurfaceVariant,
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
}));
