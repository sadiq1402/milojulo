import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../theme';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  multiline?: boolean;
};

// One field for single-line inputs and text areas (multiline).
export function Input({
  label,
  error,
  multiline = false,
  style,
  accessibilityLabel,
  ...rest
}: Props) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.secondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.textArea,
          error ? styles.invalid : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TextArea(props: Omit<Props, 'multiline'>) {
  return <Input {...props} multiline />;
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...textStyles.bodySmall, fontFamily: fontFamily(fonts.text, '600') },
  input: {
    ...textStyles.body,
    color: colors.ink,
    height: sizes.input.height,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    paddingHorizontal: sizes.input.paddingX,
  },
  textArea: {
    height: undefined,
    minHeight: sizes.input.textareaMin,
    borderRadius: radius.r20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  invalid: { borderColor: colors.danger },
});
