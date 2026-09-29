import React from 'react';
import { Dialog, DialogBody } from '#components/templates/Dialog';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';

interface BiometricSetupModalProps {
  visible: boolean;
  onComplete: (enabled: boolean) => void;
  userEmail: string;
  mode?: 'onboarding' | 'settings';
}

/**
 * Modal shell for biometric enrollment (Profile → Security). The card itself is
 * the shared `BiometricSetupView` + `useBiometricSetup`, so this stays in
 * lockstep with the onboarding step and the post-login gate.
 */
export const BiometricSetupModal = ({
  visible,
  onComplete,
  userEmail,
  mode = 'onboarding',
}: BiometricSetupModalProps) => {
  const bio = useBiometricSetup({
    mode,
    userEmail,
    active: visible,
    onComplete: enabled => onComplete(enabled),
  });

  // Hidden until probed; the hook calls onComplete if biometrics are unavailable.
  const open = visible && bio.available;

  return (
    <Dialog visible={open} onRequestClose={bio.handleSkip}>
      <DialogBody>
        <BiometricSetupView
          iconName={bio.iconName}
          title={bio.title}
          description={bio.description}
          isEnabling={bio.isEnabling}
          enableLabel={bio.enableLabel}
          skipLabel={bio.skipLabel}
          onEnable={bio.handleEnable}
          onSkip={bio.handleSkip}
        />
      </DialogBody>
    </Dialog>
  );
};
