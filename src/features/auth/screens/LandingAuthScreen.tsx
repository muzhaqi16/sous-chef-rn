import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { Button } from '#components/molecules/Button';
import { Link } from '#components/atoms/Link';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { getWebAppUrl } from '#utils/environment';
import { appAssets } from '#/assets/appAssets';
import { Text } from '#components/atoms/Text';
import { LocalImage } from '#components/atoms/LocalImage';
import { authTestIDs } from '#features/auth/testIDs';
import { motion } from '#/theme/motion';

const { damping, stiffness, mass } = motion.spring.GENTLE;
const logoEntering = ZoomIn.springify()
  .damping(damping)
  .stiffness(stiffness)
  .mass(mass);

export function LandingAuthScreen() {
  const { t } = useTranslation();
  const { toLogin, toSignUp } = useAppNavigation();

  return (
    <AuthWrapper testID={authTestIDs.landingScreen}>
      {/* 1. Hero image flex-zone */}
      <View style={styles.heroContainer}>
        <Animated.View entering={logoEntering}>
          <LocalImage
            source={appAssets.logo}
            style={styles.hero}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* 2. Content flex-zone */}
      <View style={styles.content}>
        <Text role="heading" align="left">
          {t('auth.landingTitle')}
        </Text>

        <View style={styles.accentBar} />

        <Text
          role="bodyStrong"
          tone="secondary"
          align="left"
          style={styles.subtitle}
        >
          {t('auth.landingSubtitle')}
        </Text>

        {/* A new user's way in leads; a returning one's sits under it. */}
        <View style={styles.buttons}>
          <Button
            testID={authTestIDs.landingSignUpButton}
            title={t('auth.signupTitle')}
            onPress={toSignUp}
            fullWidth
          />
          <Button
            testID={authTestIDs.landingLoginButton}
            title={t('auth.haveAccountButton')}
            onPress={toLogin}
            variant="secondary"
            fullWidth
          />
        </View>

        <Text
          role="caption"
          tone="secondary"
          align="center"
          style={styles.footerText}
        >
          {t('auth.legalNotice')}
          {'\n'}
          <Link
            variant="subtle"
            href={getWebAppUrl('/terms-of-use')}
            testID={authTestIDs.termsLink}
          >
            {t('auth.termsLink')}
          </Link>{' '}
          {t('auth.legalAnd')}{' '}
          <Link
            variant="subtle"
            href={getWebAppUrl('/privacy-policy')}
            testID={authTestIDs.privacyLink}
          >
            {t('auth.privacyLink')}
          </Link>
          .
        </Text>
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

  subtitle: {
    width: '100%',
  },

  buttons: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },

  footerText: {
    marginTop: theme.spacing.lg,
  },
  accentBar: {
    width: 40,
    height: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xs,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
}));
