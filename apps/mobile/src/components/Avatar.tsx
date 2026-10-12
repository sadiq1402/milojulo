import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, fontFamily, fonts, photoTones, sizes } from '../theme';
import { Text } from './Text';

type Props = {
  name: string;
  size?: keyof typeof sizes.avatar;
  uri?: string;
  tone?: number;
};

// Initial on a photo tone until a signed photo URL is available.
export function Avatar({ name, size = 'row', uri, tone = 0 }: Props) {
  const d = sizes.avatar[size];
  const round = { width: d, height: d, borderRadius: d / 2 };
  if (uri) {
    return (
      <Image source={{ uri }} style={round} accessibilityIgnoresInvertColors />
    );
  }
  return (
    <View
      style={[
        styles.placeholder,
        round,
        { backgroundColor: photoTones[tone % photoTones.length] },
      ]}
    >
      <Text
        style={[
          styles.initial,
          { fontSize: Math.round(d * 0.42), lineHeight: Math.round(d * 0.5) },
        ]}
      >
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: {
    fontFamily: fontFamily(fonts.display, '700'),
    color: colors.photoInitial,
  },
});
