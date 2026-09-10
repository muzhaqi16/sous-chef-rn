## Using CommonActions if you need more control

```
import { CommonActions } from '@react-navigation/native';

navigation.dispatch(
  CommonActions.navigate({
    name: 'HomeManagementStack',
    params: {
      screen: 'HomeManagement',
      params: {homeId: selectedHomeId}
    }
  })
);
```
