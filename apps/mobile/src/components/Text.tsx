import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { colors, textStyles, type TextVariant } from '../theme';

type Props = TextProps & { variant?: TextVariant; color?: string };

export function Text({
  variant = 'body',
  color = colors.ink,
  style,
  ...rest
}: Props) {
  return <RNText style={[textStyles[variant], { color }, style]} {...rest} />;
}
