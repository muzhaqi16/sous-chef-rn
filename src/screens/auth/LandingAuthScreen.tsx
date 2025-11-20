import React from 'react';
import { View, Image, Text, TouchableOpacity, Linking } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AuthWrapper, Button } from '#components';
import { useSafeNavigation } from '#hooks';
import { getWebAppUrl } from '#utils/environment';

export function LandingAuthScreen() {
  const { navigation } = useSafeNavigation();

  return (
    <AuthWrapper testID="landing-auth-screen">
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

        <View style={styles.divider} />

        <Text style={styles.subtitle}>
          Know what you have, plan what's next, and shop smarter every time.
        </Text>

        <View style={styles.buttons}>
          <Button
            testID="landing-login-button"
            title="Log In"
            onPress={() => navigation.navigate('Login')}
            variant="secondary"
            fullWidth
            txtStyle={styles.txt}
          />
          <Button
            testID="landing-signup-button"
            title="Sign Up"
            onPress={() => navigation.navigate('SignUp')}
            fullWidth
            txtStyle={styles.txt}
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
    paddingBottom: theme.spacing.xl,
  },

  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'left',
  },

  divider: {
    width: 40,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  txt: {
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: theme.fonts.size.md,
    lineHeight: theme.spacing.lg,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'left',
    width: '100%',
  },

  buttons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
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
