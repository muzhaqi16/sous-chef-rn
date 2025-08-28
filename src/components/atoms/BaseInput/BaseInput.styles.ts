import {StyleSheet} from 'react-native-unistyles';

export default StyleSheet.create((theme, rt) => ({
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    ...{
      ':w[0, sm]': {
        height: 40,
      },
      ':w[md]': {
        height: 48,
      },
    },
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    flex: 1,
    fontSize: 15,
    color: theme.colors.inputText,
    padding: 0,
  },
  iconWrapper: {
    marginLeft: 8,
  },
  errorText: {
    marginTop: 4,
    color: theme.colors.error,
    fontSize: 13,
  },
}));
