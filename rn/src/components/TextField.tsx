import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';

import { Alpha, Colors, Layout, Radius } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  // Renders a trailing eye/eye-off toggle and manages `secureTextEntry` internally
  // (for password/API-key fields) instead of each screen wiring up its own `showX` state.
  secureToggle?: boolean;
  // Tints the border/background — e.g. live password-strength feedback.
  variant?: 'default' | 'valid' | 'invalid';
}

export const TextField: React.FC<TextFieldProps> = ({ label, style, secureToggle, secureTextEntry, variant = 'default', onFocus, onBlur, ...rest }) => {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const variantStyle =
    variant === 'valid' ? styles.rowValid
    : variant === 'invalid' ? styles.rowInvalid
    : focused ? styles.rowFocused
    : null;

  const input = (
    <TextInput
      placeholderTextColor={Colors.textSecondary}
      style={[styles.input, secureToggle && styles.inputWithToggle, !secureToggle && variantStyle, style]}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secureToggle ? !revealed : secureTextEntry}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      {secureToggle ? (
        <View style={[styles.row, variantStyle]}>
          {input}
          <Pressable style={styles.eyeButton} onPress={() => setRevealed((v) => !v)} hitSlop={8}>
            {revealed ? <EyeOff size={16} color={Colors.textSecondary} /> : <Eye size={16} color={Colors.textSecondary} />}
          </Pressable>
        </View>
      ) : (
        input
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  row: {
    ...Layout.row,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSidebar,
    paddingRight: 8,
  },
  inputWithToggle: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  eyeButton: { padding: 8 },
  rowFocused: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.wash}` },
  rowValid: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.wash}` },
  rowInvalid: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.wash}` },
});
