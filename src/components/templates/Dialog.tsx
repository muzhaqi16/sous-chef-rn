import React, { useEffect } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';
import { Modal } from '#components/atoms/themedComponents';
import {
  KEYBOARD_DISMISS_MODE,
  KEYBOARD_PERSIST_TAPS,
} from '#components/templates/keyboardTaps';

interface DialogProps {
  visible: boolean;
  /** Android back. */
  onRequestClose: () => void;
  /** A `DialogBody`, optionally followed by a `DialogFooter`. */
  children: React.ReactNode;
  /**
   * Draws over what its host renders before it, not in a native Modal: iOS
   * presents a Modal from the root view controller, refuses while a screen or
   * alert is presented there, and RN never asks again. For a dialog that must
   * not be lost, mounted above navigation by a host that hides what it covers
   * from screen readers.
   */
  inTree?: boolean;
}

/**
 * A centred card and its scrim, which fade together. Keep it mounted and drive
 * `visible`: the fade-out runs only while the Modal is in the tree, and
 * unmounting a visible Modal can orphan its scrim on Android. The content
 * mounts on open, so state kept inside it starts fresh each time.
 */
export const Dialog: React.FC<DialogProps> = ({
  visible,
  onRequestClose,
  children,
  inTree = false,
}) => {
  useEffect(() => {
    if (!inTree || !visible) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onRequestClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [inTree, visible, onRequestClose]);

  const surface = (
    <View style={styles.scrim}>
      {/* Reanimated drives this node's paddingBottom, so it takes no themed style. */}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={styles.centre}>
          <View style={styles.card}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  if (inTree) {
    return visible ? (
      <View style={styles.overlay} accessibilityViewIsModal>
        {surface}
      </View>
    ) : null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {surface}
    </Modal>
  );
};

/** Scrolls when the keyboard or a large text size leaves too little room. */
export const DialogBody: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ScrollView
    alwaysBounceVertical={false}
    keyboardShouldPersistTaps={KEYBOARD_PERSIST_TAPS}
    keyboardDismissMode={KEYBOARD_DISMISS_MODE}
    contentContainerStyle={styles.body}
  >
    {children}
  </ScrollView>
);

/** Pinned below the body, so its actions stay reachable while the body scrolls. */
export const DialogFooter: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <View style={styles.footer}>{children}</View>;

const styles = StyleSheet.create((theme, rt) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
  },
  fill: {
    flex: 1,
  },
  // Full-screen either way (a `statusBarTranslucent` Modal, or the edge-to-edge
  // root an in-tree host sits in), so it clears the safe area itself.
  centre: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: rt.insets.top + theme.spacing.md,
    paddingBottom: Math.max(rt.insets.bottom, theme.spacing.lg),
  },
  card: {
    width: '100%',
    maxWidth: theme.sizes.modal.md,
    flexShrink: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    ...theme.shadows.lg,
  },
  body: {
    padding: theme.spacing.lg,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
}));
