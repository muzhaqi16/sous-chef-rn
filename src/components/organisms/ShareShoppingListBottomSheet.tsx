import React, { useState, useRef } from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, {
  type BottomSheetRef,
} from '../molecules/BottomSheet/BottomSheet';
import { Button } from '../base/Button';
import { EmailInput } from '../atoms/EmailInput';
import { useStore } from '../../store';
import {
  useAddCollaboratorMutation,
  CollaboratorRole,
} from '../../graphql/generated';
import { useOfflineDisabled } from '#hooks/useOfflineDisabled';
import { executeMutation } from '#/utils/compilerSafeWrappers';

const ShareShoppingListBottomSheet: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [email, setEmail] = useState('');
  const [renderBottomSheet, setRenderBottomSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedShoppingListId = useStore(
    state => state.selectedShoppingListId,
  );
  const shoppingListId = selectedShoppingListId;
  const [shareShoppingList] = useAddCollaboratorMutation();
  const { isDisabled: isOffline, showOfflineMessage } = useOfflineDisabled(
    'Sharing requires an internet connection',
  );

  const handleShow = () => {
    setRenderBottomSheet(true);
    bottomSheetRef.current?.expand();
  };

  const handleShare = () => {
    if (!shoppingListId || !email.trim()) {
      return;
    }
    executeMutation(
      async () => {
        await shareShoppingList({
          variables: {
            input: {
              shoppingListId,
              email: email.trim(),
              role: CollaboratorRole.Viewer, // Assuming you want to set this as collaborator
            },
          },
        });
        bottomSheetRef.current?.close();
        setEmail('');
        setError(null);
      },
      (e: unknown) => {
        setError((e as any).message);
      },
    );
  };

  return (
    <>
      <Button
        onPress={isOffline ? showOfflineMessage : handleShow}
        style={{ margin: 16 }}
      >
        Share Shopping List
      </Button>
      {!!renderBottomSheet && (
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['40%', '60%']}
          enableDynamicSizing={false}
        >
          <EmailInput
            label="User email"
            value={email}
            onChangeText={setEmail}
          />
          <Button onPress={handleShare} disabled={isOffline}>
            Share
          </Button>
          {error ? <Text style={styles.errorText}>Error: {error}</Text> : null}
        </BottomSheet>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  errorText: {
    color: theme.colors.error,
    marginTop: theme.spacing.sm,
  },
}));

export default ShareShoppingListBottomSheet;
