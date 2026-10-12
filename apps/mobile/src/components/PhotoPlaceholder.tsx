import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily, fonts, photoTones } from '../theme';
import { Text } from './Text';

type Props = {
  name: string;
  // The same Member always gets the same tone.
  seed: string;
  initialSize: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

function toneFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) {
    sum += seed.charCodeAt(i);
  }
  return photoTones[sum % photoTones.length];
}

// A photo tone and the initial until signed photo URLs exist (#35); children overlay it.
export function PhotoPlaceholder({
  name,
  seed,
  initialSize,
  style,
  children,
}: Props) {
  return (
    <View style={[styles.photo, { backgroundColor: toneFor(seed) }, style]}>
      <Text
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.initial,
          { fontSize: initialSize, lineHeight: initialSize },
        ]}
      >
        {name.trim().charAt(0).toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: {
    fontFamily: fontFamily(fonts.display, '700'),
    color: colors.photoInitial,
  },
});
