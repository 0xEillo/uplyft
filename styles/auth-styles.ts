import { StyleSheet } from 'react-native'

/**
 * Shared styles for authentication screens (login, signup).
 * Provides consistent styling for forms, inputs, buttons, and layout.
 */
export const createAuthStyles = (colors: {
  background: string
  text: string
  textSecondary: string
  border: string
  inputBackground: string
  primary: string
  buttonText: string
}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    logoTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    logo: {
      width: 54,
      height: 54,
    },
    title: {
      fontSize: 42,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    form: {
      width: '100%',
    },
    input: {
      height: 54,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 27,
      paddingHorizontal: 16,
      fontSize: 16,
      marginBottom: 16,
      backgroundColor: colors.surfaceInput,
      color: colors.textPrimary,
    },
    button: {
      height: 54,
      backgroundColor: colors.brandPrimary,
      borderRadius: 27,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    link: {
      fontSize: 15,
      color: colors.brandPrimary,
      fontWeight: '600',
    },
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    separatorText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    googleButton: {
      height: 54,
      backgroundColor: colors.surfaceInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 27,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    googleButtonText: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '600',
    },
  })
