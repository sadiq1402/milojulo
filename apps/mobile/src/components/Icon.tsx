import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, sizes } from '../theme';

// Paths copied from the mockups (24 x 24 grid, stroke 1.8).
const glyphs = {
  back: <Path d="M15 5l-7 7 7 7" />,
  chevronRight: <Path d="M9 6l6 6-6 6" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  shieldCheck: (
    <>
      <Path d="M12 3l7.5 2.8v5.7c0 4.6-3.2 7.8-7.5 9.5-4.3-1.7-7.5-4.9-7.5-9.5V5.8z" />
      <Path d="M8.8 12l2.4 2.4 4-4.6" />
    </>
  ),
  more: (
    <>
      <Circle cx="5" cy="12" r="1.4" />
      <Circle cx="12" cy="12" r="1.4" />
      <Circle cx="19" cy="12" r="1.4" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-6.5-5.6-6.5-10.8a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z" />
      <Circle cx="12" cy="10" r="2.3" />
    </>
  ),
  discover: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  activities: (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="3" />
      <Path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  circles: (
    <>
      <Circle cx="9" cy="9" r="3.2" />
      <Path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <Path d="M16 6.2a3 3 0 010 5.6M17.5 14.6c1.7.5 2.8 1.9 3.2 4.1" />
    </>
  ),
  inbox: (
    <G transform="translate(.5 .5)">
      <Path d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v6a2.5 2.5 0 01-2.5 2.5H11l-4 3.5V15h-.5A2.5 2.5 0 014 12.5z" />
    </G>
  ),
  me: (
    <>
      <Circle cx="12" cy="8.5" r="3.8" />
      <Path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" />
    </>
  ),
};

export type IconName = keyof typeof glyphs;

type Props = { name: IconName; size?: number; color?: string };

export function Icon({
  name,
  size = sizes.icon.default,
  color = colors.ink,
}: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sizes.icon.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name]}
    </Svg>
  );
}
