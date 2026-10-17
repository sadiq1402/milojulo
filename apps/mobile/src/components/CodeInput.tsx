import React, { useRef, type ComponentRef } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, sizes, textStyles } from '../theme';
import { Text } from './Text';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
};

// Six boxes drawn over one hidden input, so paste and one-time-code autofill work.
export function CodeInput({ value, onChange, length = 6 }: Props) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const digits = value.split('');
  const focused = useRef(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={styles.boxes}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              i === Math.min(value.length, length - 1) && styles.current,
            ]}
          >
            <Text style={textStyles.code}>{digits[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={text => {
          const code = text.replace(/\D/g, '').slice(0, length);
          onChange(code);
          // All digits in: drop the keyboard so the main button shows.
          if (code.length === length) {
            Keyboard.dismiss();
          }
        }}
        // Focus after the first layout, not on mount: a keyboard that opens before the
        // screen's KeyboardAvoidingView has measured itself leaves the button underneath.
        onLayout={() => {
          if (!focused.current) {
            focused.current = true;
            requestAnimationFrame(() => input.current?.focus());
          }
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: sizes.input.codeBox.gap },
  box: {
    flex: 1,
    minWidth: sizes.input.codeBox.minW,
    height: sizes.input.codeBox.h,
    borderRadius: radius.r16,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: { borderColor: colors.orchid },
  // Covers the boxes so a tap anywhere focuses it, without showing its own text.
  hidden: { ...StyleSheet.absoluteFill, color: 'transparent', opacity: 0.01 },
});
