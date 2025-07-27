import React, {useRef, useCallback, ReactNode, useMemo} from 'react';
import {View, StyleProp, ViewStyle, Text, Keyboard} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActionButton} from '../molecules';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface BottomSheetActionProps {
  actionIcon: string;
  actionColor?: string;
  actionStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  sheetTitle?: string;
  snapPoints?: string[] | number[];
}

export const BottomSheetAction: React.FC<BottomSheetActionProps> = ({
  actionIcon,
  actionColor,
  actionStyle,
  children,
  sheetTitle,
  snapPoints = ['25%', '50%', '90%'],
}) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const {styles, theme} = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const openSheet = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  return (
    <View>
      <ActionButton
        name={actionIcon}
        onPress={openSheet}
        style={actionStyle}
        color={actionColor}
      />
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="fillParent"
        enableDynamicSizing={false}
        topInset={insets.top}
        onDismiss={() => {
          // Optionally handle dismiss actions here
          Keyboard.dismiss();
        }}
        backgroundStyle={{backgroundColor: theme.colors.background}}
        handleIndicatorStyle={{backgroundColor: 'gray'}}
        backdropComponent={props => (
          <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            pressBehavior="close" // sheet closes when backdrop is pressed
          />
        )}>
        <BottomSheetView style={{padding: 16, flex: 1}}>
          {sheetTitle && <Text style={styles.sheetTitle}>{sheetTitle}</Text>}
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.textPrimary,
  },
}));
