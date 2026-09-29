import React from 'react';
import { ScrollView, View } from 'react-native';
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
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onRequestClose}
    statusBarTranslucent
    navigationBarTranslucent
  >
    <View style={styles.scrim}>
      {/* Reanimated drives this node's paddingBottom, so it takes no themed style. */}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={styles.centre}>
          <View style={styles.card}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>
);

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
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
  },
  fill: {
    flex: 1,
  },
  // The Modal is full-screen (`statusBarTranslucent`), so it clears the safe
  // area itself.
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
