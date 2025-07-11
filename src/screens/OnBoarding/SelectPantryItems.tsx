import React, {useState} from 'react';
import {TouchableOpacity, Text, View, ActivityIndicator} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {OnBoardingWrapper} from '../../components/templates';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {CreateShoppingListNavProp} from '../../navigation/types';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {
  useOnBoardingPantryItemsQuery,
  OnBoardingPantryItemsQuery,
  useAddItemToPantryMutation,
  useHomeQuery,
} from '../../graphql/generated';
import {useStore} from '../../store';
import {OnBoardingSteps} from '../../store/slices/preferencesSlice';
import {Button} from '../../components';

type PartialItem = NonNullable<
  OnBoardingPantryItemsQuery['onBoardingPantryItems']
>[number];

export const SelectPantryItems = () => {
  // 1) ALL hooks at the top, no early returns before these
  const navigation = useNavigation<CreateShoppingListNavProp>();
  const {styles} = useStyles(stylesheet);
  const {
    selectedPantryId,
    setSelectedPantryId,
    setOnBoardingStep,
    setOnBoardingCompleted,
  } = useStore();

  const {data: homeData} = useHomeQuery({
    fetchPolicy: 'cache-and-network',
    onCompleted: data => {
      if (data.home?.defaultPantry) {
        setSelectedPantryId(data.home.defaultPantry.id);
      }
    },
    onError: e => console.error(e),
  });

  const {
    data,
    loading,
    error: queryError,
  } = useOnBoardingPantryItemsQuery({
    fetchPolicy: 'cache-and-network',
    onError: e => console.error(e),
  });

  const [addItemToPantry] = useAddItemToPantryMutation({
    onCompleted: () => {
      console.log('Item added to pantry successfully');
    },
    onError: e => console.error(e),
  });

  const [selected, setSelected] = useState<PartialItem[]>([]);

  // 2) Now it’s safe to early-return or switch UI
  if (loading) {
    return <ActivityIndicator style={styles.loader} />;
  }
  if (queryError) {
    return (
      <Text style={styles.errorText}>
        Unable to load items. Please try again.
      </Text>
    );
  }

  // 3) Your handlers, toggle by comparing item.id
  const handleSelect = (item: PartialItem) => {
    setSelected(current => {
      const exists = current.find(i => i.id === item.id);
      if (exists) {
        return current.filter(i => i.id !== item.id);
      }
      if (current.length >= 3) {
        console.warn('You can only select up to 3 items');
        return current;
      }
      return [...current, item];
    });
  };
  const onNext = () => {
    if (selected.length === 0) {
      console.warn('No items selected');
      return;
    }
    selected.forEach(item =>
      addItemToPantry({
        variables: {
          input: {
            itemId: item.id,
            quantity: 1,
            pantryId:
              selectedPantryId || homeData?.home?.defaultPantry?.id || '',
            // unitId: item?.units?.[0]?.id || '',
            unitId: '6866d8cf7e407304a63718ba', //ounces for now, change later
          },
        },
      }),
    );
    // Navigate to the next step in the onboarding process
    setOnBoardingStep(OnBoardingSteps.selectPantryItems);
    setOnBoardingCompleted(true);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            // this is the final step, so we can go to Home
            name: 'Home',
          },
        ],
      }),
    );
  };

  // 4) Finally render
  return (
    <OnBoardingWrapper
      title="Select pantry items"
      subtitle="Choose a few items that you might already have"
      step={2}
      totalSteps={4}
      onBack={() => navigation.goBack()}
      onSkip={() => navigation.replace('Home', {screen: 'Main'})}>
      <KeyboardAwareScrollView style={styles.form}>
        <View style={styles.picker}>
          {data!.onBoardingPantryItems?.map(item => {
            const active = selected.some(
              selectedItem => selectedItem.id === item.id,
            );
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item)}
                style={[styles.pickerItem, active && styles.pickerItemActive]}>
                <Text
                  style={[
                    styles.pickerLabel,
                    active && styles.pickerLabelActive,
                  ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </KeyboardAwareScrollView>

      <Button
        title="Next"
        onPress={onNext}
        btnStyle={[
          styles.nextButton,
          selected.length === 0 && styles.nextButtonDisabled,
        ]}
        txtStyle={styles.nextText}
        disabled={selected.length === 0}
      />

      <TouchableOpacity onPress={onNext} style={[]}></TouchableOpacity>
    </OnBoardingWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
  form: {
    flex: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerItem: {
    margin: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c9d3db',
    borderRadius: 12,
  },
  pickerItemActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
  },
  pickerLabelActive: {
    color: theme.colors.white,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginVertical: 12,
  },
  loader: {
    marginVertical: 24,
  },
}));
