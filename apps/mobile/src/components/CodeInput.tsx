import React, { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
        onChangeText={text =>
          onChange(text.replace(/\D/g, '').slice(0, length))
        }
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
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
