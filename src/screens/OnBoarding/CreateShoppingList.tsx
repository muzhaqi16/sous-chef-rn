import React, {useState} from 'react';
import {
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
  TextInput,
} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import FeatherIcon from '@react-native-vector-icons/feather';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import Ionicons from '@react-native-vector-icons/ionicons';
import {useStore} from '../../store/useStore';

const errors = {bio: ''};

export default function CreateShoppingList() {
  const {styles, theme} = useStyles(stylesheet);
  const {user} = useStore();

  console.log('user', user);

  const [form, setForm] = useState({
    shoppingListName: '',
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // handle onPress
          }}
          style={styles.headerAction}>
          <FeatherIcon
            color={theme.colors.primary}
            name="arrow-left"
            size={24}
          />
        </TouchableOpacity>

        <Text style={styles.title}>Let's create your first shopping list</Text>

        <Text style={styles.subtitle}>
          Enter your first shopping list name, you can create more later
        </Text>
      </View>

      <KeyboardAwareScrollView
        style={styles.form}
        contentContainerStyle={{
          flex: 1,
          alignContent: 'space-around',
        }}>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>Shopping List Name</Text>

          <View style={styles.formInput}>
            <View style={styles.formIcon}>
              <Ionicons color="#889797" name="list" size={20} />
            </View>

            <TextInput
              clearButtonMode="while-editing"
              onChangeText={name => setForm({...form, shoppingListName: name})}
              placeholder="Your shopping list name"
              placeholderTextColor="#6b7280"
              style={styles.formInputControl}
              value={form.shoppingListName}
            />
          </View>
        </View>

        <View style={styles.formAction}>
          <TouchableOpacity
            onPress={() => {
              // handle onPress
            }}>
            <View style={styles.btn}>
              <Text style={styles.btnText}>Next</Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const stylesheet = createStyleSheet(theme => ({
  container: {flex: 1, backgroundColor: theme.colors.background},
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  /** Header */
  header: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffdada',
    marginVertical: 16,
  },
  /** Form */
  form: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingVertical: 0,
    paddingHorizontal: 24,
    alignContent: 'flex-start',
  },
  formLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  formInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  formInputControl: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingRight: 16,
    paddingLeft: 0,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#222',
    paddingVertical: 12,
  },
  formTextarea: {
    paddingTop: 12,
    height: 120,
  },
  formGroup: {
    marginBottom: 24,
    flex: 1,
  },
  formIcon: {
    paddingLeft: 12,
  },
  formLink: {
    textAlign: 'right',
    fontWeight: '600',
    color: '#F82E08',
    textDecorationLine: 'underline',
    textDecorationColor: '#F82E08',
    textDecorationStyle: 'solid',
    position: 'absolute',
    right: 8,
    top: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  formGroupFooter: {
    fontSize: 13,
    lineHeight: 18,
    color: '#889797',
  },
  formAction: {
    marginVertical: 24,
  },
  /** Button */
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    backgroundColor: '#F82E08',
    borderColor: '#F82E08',
  },
  btnText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
}));
