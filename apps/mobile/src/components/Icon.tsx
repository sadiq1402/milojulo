import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, sizes } from '../theme';

// Paths copied from the mockups (24 x 24 grid, stroke 1.8).
const glyphs = {
  back: <Path d="M15 5l-7 7 7 7" />,
  chevronRight: <Path d="M9 6l6 6-6 6" />,
  chevronDown: <Path d="M6 9l6 6 6-6" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  trash: <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  camera: (
    <>
      <Rect x="3.5" y="6.5" width="17" height="13" rx="3" />
      <Circle cx="12" cy="13" r="3.3" />
      <Path d="M9 6.5l1-2h4l1 2" />
    </>
  ),
  image: (
    <>
      <Rect x="4" y="5" width="16" height="14" rx="3" />
      <Circle cx="9" cy="10" r="1.6" />
      <Path d="M5 17l4.5-4.5L13 16l3-3 3 3.5" />
    </>
  ),
  mic: (
    <>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" />
    </>
  ),
  play: <Path d="M8 5.5v13l11-6.5z" />,
  pause: <Path d="M8 5v14M16 5v14" />,
  calendar: (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="3" />
      <Path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  calendarCheck: (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="3" />
      <Path d="M9 13l2.2 2.2L15.5 11M9 3v4M15 3v4" />
    </>
  ),
  directions: <Path d="M3 11l18-8-8 18-2-8z" />,
  send: <Path d="M21 3L10 14M21 3l-6.5 18-3.5-7-7-3.5z" />,
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
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" />
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
  star: (
    <Path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
  ),
  people: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.5 3 5.2" />
    </>
  ),
  // Activity types.
  sports: (
    <>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M5 9c4 1 10 1 14 0M5 15c4-1 10-1 14 0" />
    </>
  ),
  cup: (
    <Path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3" />
  ),
  mountain: <Path d="M3 19l6-10 4 6 2-3 6 7z" />,
  gamepad: (
    <>
      <Rect x="3" y="7" width="18" height="11" rx="5" />
      <Path d="M8 11v3M6.5 12.5h3M15 12h.01M17 14h.01" />
    </>
  ),
  cap: <Path d="M3 8l9-4 9 4-9 4zM7 10v5c3 2 7 2 10 0v-5" />,
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
