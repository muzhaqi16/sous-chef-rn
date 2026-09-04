import { useEffect, useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { authoritativeBiometryName } from './biometryLabel';

/**
 * The three contexts a biometric enrollment card appears in. They differ only in
 * copy, where the password comes from, and what completion does — the UI and
 * enrolment logic are identical, which is why they live here.
 */
export type BiometricSetupMode = 'onboarding' | 'postLogin' | 'settings';

interface BiometricInfo {
  isAvailable: boolean;
  biometryType: string | null;
}

interface UseBiometricSetupParams {
  mode: BiometricSetupMode;
  userEmail: string;
  /** False leaves the card dormant and skips the availability probe. */
  active?: boolean;
  onComplete: (enabled: boolean, declined?: boolean) => void;
}

const biometryIcon = (type: string | null): string => {
  switch (type) {
    case 'Face ID':
      return 'scan-outline';
    case 'Touch ID':
    case 'Fingerprint':
      return 'finger-print';
    default:
      return 'finger-print';
  }
};

/**
 * Module-level so the try/catch stays out of the hook body, which would bail the
 * React Compiler out. Returns a safe "unavailable" snapshot on error.
 */
async function loadBiometricSnapshot(
  mode: BiometricSetupMode,
  userEmail: string,
): Promise<{ info: BiometricInfo; hasCredentials: boolean }> {
  try {
    const [info, hasCredentials] = await Promise.all([
      authService.getBiometricInfo(),
      mode === 'settings'
        ? authService.checkStoredCredentials(userEmail)
        : Promise.resolve(false),
    ]);
    return { info, hasCredentials };
  } catch (error) {
    errorService.reportError(error, { operation: 'loadBiometricInfo' });
    return {
      info: { isAvailable: false, biometryType: null },
      hasCredentials: false,
    };
  }
}

/**
 * Shared by every enrollment surface so copy, the availability probe and the
 * enrolment call live in one place. Render the result with
 * `BiometricSetupView`.
 */
export const useBiometricSetup = ({
  mode,
  userEmail,
  active = true,
  onComplete,
}: UseBiometricSetupParams) => {
  const { t } = useTranslation();
  // postLogin availability is pre-checked upstream, so default to available there
  // and avoid a blank flash before the probe resolves.
  const [info, setInfo] = useState<BiometricInfo>({
    isAvailable: mode === 'postLogin',
    biometryType: null,
  });
  const [checked, setChecked] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);

  // State is set only from the async callback, never synchronously in the effect
  // body, so this cannot cascade renders.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadBiometricSnapshot(mode, userEmail).then(
      ({ info: probed, hasCredentials }) => {
        if (cancelled) return;
        setInfo(probed);
        setHasExistingCredentials(hasCredentials);
        setChecked(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, mode, userEmail]);

  // Completing quietly here is NOT a user decline.
  useEffect(() => {
    if (active && checked && !info.isAvailable) {
      onComplete(false);
    }
  }, [active, checked, info.isAvailable, onComplete]);

  const handleEnable = () => {
    if (isEnabling) return;

    executeWithLoadingState(
      async () => {
        if (mode === 'settings' && hasExistingCredentials) {
          const credentials = await authService.loadStoredCredentials(
            userEmail,
          );
          if (credentials) {
            onComplete(true);
          } else {
            alertService.alert(
              t('biometricSetup.authRequiredTitle'),
              t('biometricSetup.authRequiredMessage'),
              [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
            );
          }
          return;
        }

        // The live session authorises the enrolment: the server issues a
        // device-bound credential and the slot takes that, so no password is
        // read here or anywhere else on this path.
        const success = await authService.enrolDeviceCredential(userEmail);
        if (success) {
          onComplete(true);
        } else {
          alertService.alert(
            t('biometricSetup.setupFailedTitle'),
            t('biometricSetup.setupFailedGenericMessage'),
            [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
          );
        }
      },
      setIsEnabling,
      error => {
        errorService.reportError(error, { operation: 'enableBiometricAuth' });
        alertService.alert(
          t('biometricSetup.setupFailedTitle'),
          t('biometricSetup.setupFailedGenericMessage'),
          [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
        );
      },
    );
  };

  // An explicit decline everywhere except settings, where dismissing the modal is
  // not a permanent "don't ask again".
  const handleSkip = () => {
    onComplete(false, mode !== 'settings');
  };

  const named = authoritativeBiometryName(info.biometryType);
  const fallbackType = named ?? t('labels.biometric');
  const authTypeLabel = named ?? t('labels.biometricAuthentication');

  return {
    checking: !checked,
    available: info.isAvailable,
    biometryType: info.biometryType,
    iconName: biometryIcon(info.biometryType),
    title:
      mode === 'postLogin'
        ? t('postLoginBiometric.title', { type: fallbackType })
        : t('biometricSetup.title', { type: fallbackType }),
    description:
      mode === 'postLogin'
        ? t('postLoginBiometric.description', { authType: authTypeLabel })
        : t('biometricSetup.description', { authType: authTypeLabel }),
    benefits: [
      t('biometricSetup.benefitQuickAccess'),
      t('biometricSetup.benefitNoPassword'),
      t('biometricSetup.benefitEnhancedSecurity'),
    ],
    footer: t('biometricSetup.footer'),
    isEnabling,
    enableLabel: isEnabling ? t('labels.settingUp') : t('labels.enableNow'),
    skipLabel:
      mode === 'postLogin'
        ? t('labels.notNow')
        : t('biometricSetup.setupLater'),
    handleEnable,
    handleSkip,
  };
};
