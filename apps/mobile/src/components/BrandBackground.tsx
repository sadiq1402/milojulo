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

// The dark brand surface behind the logo (BrandLoader, Welcome): ink deepening to orchid, with an
// orchid glow where the logo sits, so the white "Milo" and the gradient "Julo" both read.
export function BrandBackground({ glowY = '44%' }: { glowY?: string }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="brandGround" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={colors.ink} />
          <Stop offset="0.55" stopColor={colors.ink} />
          <Stop offset="1" stopColor={colors.orchidDark} />
        </LinearGradient>
        <RadialGradient id="brandGlow" cx="50%" cy={glowY} r="55%">
          <Stop offset="0" stopColor={colors.orchid} stopOpacity={0.45} />
          <Stop offset="0.6" stopColor={colors.violet} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.violet} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#brandGround)" />
      <Rect width="100%" height="100%" fill="url(#brandGlow)" />
    </Svg>
  );
}
