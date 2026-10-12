import type { TextStyle, ViewStyle } from 'react-native';
import { fonts, shadows, type } from '../../../../design/tokens';

export * from '../../../../design/tokens';

// Android picks a custom font by file name, so each weight is its own family.
const fontFiles: Record<string, Record<string, string>> = {
  [fonts.display]: { '700': 'BricolageGrotesque-Bold' },
  [fonts.text]: {
    '400': 'Figtree-Regular',
    '500': 'Figtree-Medium',
    '600': 'Figtree-SemiBold',
    '700': 'Figtree-Bold',
  },
};

export function fontFamily(family: string, weight: string): string {
  return fontFiles[family][weight];
}

export type TextVariant = keyof typeof type;

// Display styles are set slightly tight, as in the mockups.
const tracking: Partial<Record<TextVariant, number>> = {
  display: -0.015,
  h1: -0.02,
  h2: -0.01,
};

export const textStyles = Object.fromEntries(
  Object.entries(type).map(([variant, t]) => [
    variant,
    {
      fontFamily: fontFamily(t.family, t.weight),
      fontSize: t.size,
      lineHeight: t.line,
      letterSpacing: (tracking[variant as TextVariant] ?? 0) * t.size,
    },
  ]),
) as Record<TextVariant, TextStyle>;

export function shadow(token: keyof typeof shadows): ViewStyle {
  const s = shadows[token];
  return { boxShadow: `0 ${s.offsetY}px ${s.blur}px ${s.color}` };
}
