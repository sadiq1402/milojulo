import React, { type ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fontFamily, fonts, photoTones } from '../theme';
import { Text } from './Text';

type Props = {
  name: string;
  // The same Member always gets the same tone.
  seed: string;
  initialSize: number;
  // A signed link; the initial shows while it loads, or without one.
  uri?: string | null;
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

// The photo over a tone and the initial; children overlay it.
export function PhotoPlaceholder({
  name,
  seed,
  initialSize,
  uri,
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
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Photo of ${name}`}
          accessibilityIgnoresInvertColors
        />
      ) : null}
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
