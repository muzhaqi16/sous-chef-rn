import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Keyboard} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import FeatherIcon from '@react-native-vector-icons/feather';
import {useStore} from '../../store/useStore';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import AuthFormFields from '../molecules/AuthFormFields';
import {getLoginValidationSchema} from '../../utils/validation';
import Loader from '../atoms/Loader';
import {Header} from '../molecules/Header';

export interface FormValues {
  email: string;
  password: string;
}

interface LoginFormProps {}

const LoginForm: React.FC<LoginFormProps> = ({}) => {
  const {styles} = useStyles(stylesheet);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {login} = useStore();

  // Generate validation schema from a utility function
  const validationSchema = getLoginValidationSchema();

  // Set up react-hook-form
  const {
    reset,
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormValues>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: 'artan@muzhaqi.com',
      password: 'Test123!',
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    console.log('Form submitted with data:', data);
    setLoading(true);
    Keyboard.dismiss();

    const resp = await login(data.email, data.password);
    if (resp) {
      setError(resp);
    }
    reset();
    setLoading(false);
  };

  return (
    <>
      {loading && <Loader />}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // handle onPress
          }}
          style={styles.headerAction}>
          <FeatherIcon color="#F82E08" name="arrow-left" size={24} />
        </TouchableOpacity>
        <Header />
        <Text style={styles.title}>
          Sign in to <Text style={{color: '#075eec'}}>MyApp</Text>
        </Text>

        <Text style={styles.subtitle}>
          Get access to your portfolio and more
        </Text>
      </View>
      <KeyboardAwareScrollView>
        <View style={styles.form}>
          <AuthFormFields control={control} errors={errors} />

          <TouchableOpacity
            onPress={() => {
              // handle onPress
            }}>
            <Text style={styles.formLink}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.formAction}>
            <TouchableOpacity onPress={handleSubmit(onSubmit)}>
              <View style={styles.btn}>
                <Text style={styles.btnText}>Login</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Server / Store Error */}
        {error && <Text style={styles.error}>{error}</Text>}
      </KeyboardAwareScrollView>
      <TouchableOpacity onPress={() => {}}>
        <Text style={styles.formFooter}>
          Don't have an account? <Text style={styles.formLink}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </>
  );
};

const stylesheet = createStyleSheet(theme => ({
  /** Header */
  header: {
    paddingHorizontal: 24,
    marginVertical: 28,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffdada',
    marginBottom: 16,
  },
  /** Form */
  form: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingHorizontal: 24,
  },
  formLink: {
    textAlign: 'right',
    fontWeight: '600',
    color: '#F82E08',
    textDecorationLine: 'underline',
    textDecorationColor: '#F82E08',
    textDecorationStyle: 'solid',
  },
  formAction: {
    marginVertical: 24,
  },
  formFooter: {
    marginTop: 'auto',
    marginBottom: 24,
    paddingHorizontal: 24,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    color: '#9fa5af',
    textAlign: 'center',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginBottom: 16,
    color: theme.colors.typography,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.typography,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
}));

export default LoginForm;
