import {useCallback} from 'react';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import {
  useFocusEffect,
  useNavigation,
  CommonActions,
} from '@react-navigation/native';

export const useOnboardingSkip = (
  query: any,
  items: any[],
  nextStep: OnBoardingSteps,
  nextScreen: string,
  setSelected?: (id: string) => void,
) => {
  const {setOnBoardingStep} = useStore();
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!query.loading && items.length > 0) {
        console.log(`Skipping to ${nextScreen} - items already exist`);
        if (setSelected) {
          setSelected(items[0].id);
        }
        setOnBoardingStep(nextStep);

        // Use CommonActions.reset instead of replace
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{name: nextScreen}],
          }),
        );
      }
    }, [
      items,
      query.loading,
      nextScreen,
      nextStep,
      setSelected,
      setOnBoardingStep,
      navigation,
    ]),
  );

  return query.loading;
};
