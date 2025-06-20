import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import MainScreen from '../screens/MainScreen';
import ProfileScreen from '../screens/ProfileScreen';
import {type HomeTabParamList} from './types';

const Tab = createBottomTabNavigator<HomeTabParamList>();

const HomeTab = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="ShoppingList" component={MainScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default HomeTab;
