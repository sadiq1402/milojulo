import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

// The light brand surface behind the logo (BrandLoader): soft white deepening to lilac, with a
// subtle orchid glow where the logo sits; matches the light launch screens.
export function BrandBackground() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="brandGround" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={colors.ground} />
          <Stop offset="0.55" stopColor={colors.ground} />
          <Stop offset="1" stopColor={colors.lilacSoft} />
        </LinearGradient>
        <RadialGradient id="brandGlow" cx="50%" cy="44%" r="55%">
          <Stop offset="0" stopColor={colors.tintStrong} stopOpacity={0.55} />
          <Stop offset="0.6" stopColor={colors.orchid} stopOpacity={0.06} />
          <Stop offset="1" stopColor={colors.orchid} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#brandGround)" />
      <Rect width="100%" height="100%" fill="url(#brandGlow)" />
    </Svg>
  );
}
